const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises; // Menggunakan fs.promises
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2; // Impor Cloudinary

// --- Impor Model & Middleware ---
const Book = require('../models/bookModel');
const {
  validateFile,
  extractPdfMetadata,
  extractEpubMetadata,
  UPLOAD_DIR // Pastikan ini adalah path ke folder temporer, misal './temp'
} = require('../utils/fileHandler');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// --- Konfigurasi Multer ---
// Kita tidak lagi menggunakan memoryStorage agar bisa membuat file temporer
// Pastikan folder UPLOAD_DIR ada dan dapat ditulis
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Simpan file upload asli ke subfolder 'books' di UPLOAD_DIR
    const tempBookDir = path.join(UPLOAD_DIR, 'books');
    fs.mkdir(tempBookDir, { recursive: true }).then(() => {
      cb(null, tempBookDir);
    }).catch(err => cb(err));
  },
  filename: (req, file, cb) => {
    // Buat nama file unik sementara
    const uniqueSuffix = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueSuffix);
  }
});

const upload = multer({ storage: tempStorage });

// Pastikan Cloudinary dikonfigurasi di server.js
// cloudinary.config({ ... });

// --- RUTE-RUTE API ---

/**
 * POST /api/books/upload
 * Mengupload buku baru, memprosesnya, mengirim ke Cloudinary, dan menyimpan ke DB.
 */
router.post('/upload', protect, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file uploaded." });
  }

  // Path file PDF/EPUB temporer yang di-upload oleh multer
  const tempLocalPdfPath = req.file.path;
  const { originalname, size } = req.file;

  let metadata;
  let fileType;
  let tempLocalCoverPath = ''; // Path ke sampul JPG temporer
  const bookId = uuidv4(); // ID unik untuk public_id di Cloudinary

  try {
    // --- 1. Validasi dan Ekstrak Metadata (Lokal) ---
    // Kita butuh buffer untuk validasi cepat
    const buffer = await fs.readFile(tempLocalPdfPath);
    const validation = await validateFile(buffer);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    fileType = validation.mime === 'application/pdf' ? 'pdf' : 'epub';
    
    if (fileType === 'pdf') {
      metadata = await extractPdfMetadata(tempLocalPdfPath);

      // --- 2. Buat Sampul Temporer (Lokal) ---
      const coverDir = path.join(UPLOAD_DIR, 'covers');
      await fs.mkdir(coverDir, { recursive: true }); // Buat folder covers jika belum ada
      tempLocalCoverPath = path.join(coverDir, `${bookId}.jpg`);
      
      const { Poppler } = await import('node-poppler');
      const poppler = new Poppler();
      const outputPathPrefix = path.join(coverDir, bookId); // Poppler menambahkan .jpg
      
      const options = {
        jpegFile: true,
        singleFile: true,
        firstPageToConvert: 1,
        lastPageToConvert: 1
      };
      
      console.log(`[Debug] Generating temp cover for: ${tempLocalPdfPath}`);
      await poppler.pdfToCairo(tempLocalPdfPath, outputPathPrefix, options);
      console.log(`[Debug] Temp cover generated: ${tempLocalCoverPath}`);

    } else {
      metadata = await extractEpubMetadata(tempLocalPdfPath);
      // TODO: Tambahkan logika ekstraksi sampul EPUB jika ada
      // Untuk saat ini, kita biarkan tempLocalCoverPath kosong
    }

    // --- 3. Upload ke Cloudinary ---
    console.log('[Cloudinary] Uploading PDF/EPUB...');
    const pdfUploadResult = await cloudinary.uploader.upload(tempLocalPdfPath, {
      resource_type: "raw",
      folder: "ebook-reader/books",
      public_id: bookId
    });

    let coverUploadResult;
    if (tempLocalCoverPath && await fs.stat(tempLocalCoverPath).catch(() => false)) {
      console.log('[Cloudinary] Uploading Cover...');
      coverUploadResult = await cloudinary.uploader.upload(tempLocalCoverPath, {
        resource_type: "image",
        folder: "ebook-reader/covers",
        public_id: bookId
      });
    }

    // --- 4. Simpan URL Cloudinary ke DB ---
    const newBook = new Book({
      _id: bookId, // Gunakan bookId sebagai _id
      user_id: req.user._id,
      title: req.body.title || metadata.title || originalname.replace(/\.[^/.]+$/, ""),
      file_name: originalname,
      file_type: fileType,
      file_path: pdfUploadResult.secure_url,
      cover_image: coverUploadResult ? coverUploadResult.secure_url : '/default-cover.jpg', // URL sampul default jika tidak ada
      
      // Simpan public_id untuk keperluan HAPUS
      file_public_id: pdfUploadResult.public_id,
      cover_public_id: coverUploadResult ? coverUploadResult.public_id : null,
      
      file_size: size,
      total_pages: metadata.total_pages || 0,
      category: req.body.category || 'menu_book',
    });
    
    const savedBook = await newBook.save();
    console.log('[Debug] Book saved successfully with _id:', savedBook._id);
    
    res.status(200).json({ success: true, book: savedBook });

  } catch (error) {
    console.error('[Upload Error]:', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    // --- 5. Bersihkan Semua File Temporer ---
    try {
      await fs.unlink(tempLocalPdfPath);
      if (tempLocalCoverPath) await fs.unlink(tempLocalCoverPath);
      console.log('[Debug] Temporary local files deleted.');
    } catch (cleanupError) {
      console.error('[Cleanup Error] Could not delete temp files:', cleanupError.message);
    }
  }
});

/**
 * GET /api/books
 * Mengambil semua buku milik pengguna yang sedang login.
 */
router.get('/', protect, async (req, res) => {
  const { status, search, sort } = req.query;
  let query = { user_id: req.user._id }; // Filter berdasarkan user yang login

  if (status && status !== 'all') query.status = status;
  if (search) query.title = { $regex: search, $options: 'i' };
  
  const sortOptions = {
    'last_read': { last_read: -1 },
    'title': { title: 1 },
    'uploaded_at': { createdAt: -1 } // Gunakan 'createdAt' dari timestamps
  };

  try {
    const books = await Book.find(query).sort(sortOptions[sort] || sortOptions.last_read);
    res.status(200).json({ success: true, books: books, total: books.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/books/:id
 * Mengambil satu buku, memverifikasi kepemilikan.
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book || book.user_id.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, error: "Book not found" });
    }
    
    res.status(200).json({ success: true, book: book });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/books/:id/progress
 * Memperbarui progres baca buku.
 */
router.put('/:id/progress', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { current_page, total_pages } = req.body;

    if (current_page === undefined || total_pages === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: "current_page and total_pages are required" 
      });
    }

    const book = await Book.findById(id);

    if (!book || book.user_id.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, error: "Book not found" });
    }

    const progress = Math.round((current_page / total_pages) * 100);
    
    let status = 'reading';
    if (progress >= 100) {
      status = 'completed';
    } else if (current_page <= 1 && book.progress === 0) { // Hanya set 'not-started' jika belum dimulai
      status = 'not-started';
    }

    // Update buku
    const updatedBook = await Book.findByIdAndUpdate(
      id,
      {
        current_page: current_page,
        total_pages: total_pages, // Simpan total_pages jika belum ada
        progress: progress,
        status: status,
        last_read: new Date()
      },
      { new: true } // Mengembalikan dokumen yang sudah di-update
    );

    console.log(`[Progress] ${updatedBook.title}: Page ${current_page}/${total_pages} (${progress}%) - ${status}`);

    res.status(200).json({ 
      success: true, 
      book: updatedBook,
      message: "Progress updated successfully"
    });

  } catch (error) {
    console.error("[Progress Update Error]:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/books/:id
 * Menghapus buku dari Cloudinary dan Database.
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const book = await Book.findById(id);

    if (!book || book.user_id.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, error: "Book not found" });
    }

    // --- LOGIKA BARU: Hapus dari Cloudinary ---
    try {
      if (book.file_public_id) {
        await cloudinary.uploader.destroy(book.file_public_id, { resource_type: "raw" });
        console.log(`[Cloudinary] Deleted file: ${book.file_public_id}`);
      }
      if (book.cover_public_id) {
        await cloudinary.uploader.destroy(book.cover_public_id, { resource_type: "image" });
        console.log(`[Cloudinary] Deleted cover: ${book.cover_public_id}`);
      }
    } catch (cloudErr) {
      console.warn(`Could not delete cloud files (orphaned?): ${cloudErr.message}`);
      // Lanjutkan proses hapus dari DB
    }
    // ------------------------------------------

    await Book.findByIdAndDelete(id);

    res.status(200).json({ 
      success: true, 
      message: "Book deleted successfully", 
      deletedBookId: id
    });

  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
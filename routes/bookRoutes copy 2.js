const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const { v4: uuidv4 } = require('uuid');
// Hapus semua 'require('pdf-poppler')'
const Book = require('../models/bookModel');
const {
  validateFile,
  extractPdfMetadata,
  extractEpubMetadata,
  UPLOAD_DIR
} = require('../utils/fileHandler');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /api/books/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file uploaded." });
  }

  const { buffer, originalname, size } = req.file;

  // 1. Validasi file
  const validation = await validateFile(buffer);
  if (!validation.isValid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  // 2. Simpan file ke disk
  const bookId = uuidv4();
  const fileExt = path.extname(originalname);
  const uniqueFilename = `${bookId}_original${fileExt}`;
  const filePath = path.join(UPLOAD_DIR, 'books', uniqueFilename);
  await fs.writeFile(filePath, buffer);

  // 3. Ekstrak metadata
  const fileType = validation.mime === 'application/pdf' ? 'pdf' : 'epub';
  let metadata;
  if (fileType === 'pdf') {
    metadata = await extractPdfMetadata(filePath);
  } else {
    metadata = await extractEpubMetadata(filePath);
  }

  let coverFilename = `${bookId}.jpg`; // Nama file sampul default

  // 4. Buat cover image (menggunakan node-poppler)
  // 4. Buat cover image (menggunakan node-poppler)
if (fileType === 'pdf') {
  try {
    // 1. Muat library baru
    const { Poppler } = await import('node-poppler');
    const poppler = new Poppler();

    const coverDir = path.join(UPLOAD_DIR, 'covers');
    // UBAH BARIS INI: Hapus .jpg dari nama path
    const outputPathPrefix = path.join(coverDir, `${bookId}`);
    // 2. Opsi untuk pdfToCairo (method yang benar)
    const options = {
      jpegFile: true,        // Output sebagai JPEG
      singleFile: true,      // Satu file output
      firstPageToConvert: 1, // Halaman pertama
      lastPageToConvert: 1   // Hanya halaman pertama
    };
    
    console.log(`[Debug] Attempting to generate cover for: ${filePath}`);
    
    // 3. Panggil pdfToCairo (BUKAN pdfToImg)
   await poppler.pdfToCairo(filePath, outputPathPrefix, options);
    
    coverFilename = `${bookId}.jpg`; 
    
    console.log(`[Debug] Cover generated successfully: ${coverFilename}`);
  } catch (err) {
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("!!!     COVER GENERATION FAILED    !!!");
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("Pastikan Poppler (program sistem) terinstal dan ada di PATH Windows.");
    console.error("Error Details:", err);
  }
}

  // 5. Buat entri di database
  try {
    const newBook = new Book({
      _id: bookId,
      user_id: req.user.id, // <-- 3. TAMBAHKAN ID USER
      title: req.body.title || metadata.title,
      file_name: originalname,
      file_type: fileType,
      file_path: `/uploads/books/${uniqueFilename}`,
      file_size: size,
      cover_image: `/uploads/covers/${coverFilename}`, 
      total_pages: metadata.total_pages || 0, // Pastikan ada fallback
      category: req.body.category || 'menu_book',
    });
    const savedBook = await newBook.save();
    res.status(200).json({ success: true, book: savedBook });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/books
router.get('/', async (req, res) => {
  const { status, search, sort } = req.query;
  let query = {};

  if (status && status !== 'all') query.status = status;
  if (search) query.title = { $regex: search, $options: 'i' };
  
  const sortOptions = {
    'last_read': { last_read: -1 },
    'title': { title: 1 },
    'uploaded_at': { uploaded_at: -1 }
  };
  query.user_id = req.user.id; // <-- 4. TAMBAHKAN FILTER USER

  try {
    const books = await Book.find(query).sort(sortOptions[sort] || sortOptions.last_read);
    res.status(200).json({ success: true, books: books, total: books.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/books/:id
router.get('/:id', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    i// 5. Cek apakah buku ditemukan DAN apakah milik user
    if (!book || book.user_id.toString() !== req.user.id) {
      return res.status(404).json({ success: false, error: "Book not found" });
    }
    
    res.status(200).json({ success: true, book: book });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// DELETE /api/books/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const book = await Book.findById(id);

    // 6. Cek apakah buku ditemukan DAN apakah milik user
    if (!book || book.user_id.toString() !== req.user.id) {
      return res.status(404).json({ success: false, error: "Book not found" });
    }

    // 1. Tentukan path file (dari root proyek)
    // Kita menggunakan path.join dengan '..' untuk naik dari /routes ke root folder
    const bookFilePath = path.join(__dirname, '..', book.file_path);
    const coverFilePath = path.join(__dirname, '..', book.cover_image);

    // 2. Hapus file dari filesystem
    try {
      await fs.unlink(bookFilePath);
      await fs.unlink(coverFilePath);
      console.log(`[Debug] Deleted files: ${book.file_path} & ${book.cover_image}`);
    } catch (fileErr) {
      // Jika file tidak ada, jangan hentikan proses. Cukup catat.
      console.warn(`Could not delete file (may be missing): ${fileErr.message}`);
    }

    // 3. Hapus buku dari database
    await Book.findByIdAndDelete(id);

    res.status(200).json({ 
      success: true, 
      message: "Book deleted successfully", 
      deletedBookId: id // Kirim ID kembali agar frontend tahu
    });

  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
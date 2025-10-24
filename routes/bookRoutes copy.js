const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const { v4: uuidv4 } = require('uuid');

//const poppler = require('pdf-poppler');
const Book = require('../models/bookModel');
const {
  validateFile,
  extractPdfMetadata,
  extractEpubMetadata,
  UPLOAD_DIR
} = require('../utils/fileHandler');

const router = express.Router();
// Multer dikonfigurasi untuk menyimpan file di memory agar bisa divalidasi dulu
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

  // 4. Buat cover image
 // --- GANTI DENGAN INI (YANG BARU) ---
    if (fileType === 'pdf') {
    try {
      // --- DEFINISIKAN coverPath DI SINI ---
     const coverPath = path.join(UPLOAD_DIR, 'covers', `${bookId}.jpg`); 
      console.log(`[Debug] Attempting to generate cover for: ${filePath}`);

      console.log(`[Debug] Attempting to generate cover for: ${filePath}`);
      const poppler = await import('pdf-poppler');
      const convertOptions = {
        format: 'jpeg',
        out_dir: path.dirname(coverPath),
        out_prefix: path.basename(coverPath, '.jpg'),
        page: 1
      };
      //await pdf2img(filePath, convertOptions);
      //await poppler.pdf2img(filePath, convertOptions);
      // INI YANG BENAR
      await poppler.default.pdf2img(filePath, convertOptions);
      
      console.log(`[Debug] Cover generated successfully: ${coverPath}`);
    } catch (err) {
      console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.error("!!!     COVER GENERATION FAILED    !!!");
      console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.error("Pastikan Poppler terinstal dan ada di PATH Windows.");
      console.error("Error Details:", err);
    }
  }

  // 5. Buat entri di database
  try {
    const newBook = new Book({
      _id: bookId,
      title: req.body.title || metadata.title,
      file_name: originalname,
      file_type: fileType,
      //file_path: filePath,
      file_path: `/uploads/books/${uniqueFilename}`,
      file_size: size,
      cover_image: `/uploads/covers/${bookId}.jpg`,
      total_pages: metadata.total_pages,
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

  try {
    const books = await Book.find(query).sort(sortOptions[sort] || sortOptions.last_read);
    res.status(200).json({ success: true, books: books, total: books.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/books/:id (Get Single Book)
router.get('/:id', async (req, res) => {
  try {
    // Temukan buku berdasarkan _id string
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ success: false, error: "Book not found" });
    }

    // Jika ditemukan, kirim kembali data bukunya
    res.status(200).json({ success: true, book: book });

  } catch (error) {
    // Menangani error jika ID tidak valid
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
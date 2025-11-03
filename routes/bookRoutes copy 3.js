const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const { v4: uuidv4 } = require('uuid');
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
router.post('/upload', protect, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file uploaded." });
  }

  const { buffer, originalname, size } = req.file;

  const validation = await validateFile(buffer);
  if (!validation.isValid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  const bookId = uuidv4();
  const fileExt = path.extname(originalname);
  const uniqueFilename = `${bookId}_original${fileExt}`;
  const filePath = path.join(UPLOAD_DIR, 'books', uniqueFilename);
  await fs.writeFile(filePath, buffer);

  const fileType = validation.mime === 'application/pdf' ? 'pdf' : 'epub';
  let metadata;
  if (fileType === 'pdf') {
    metadata = await extractPdfMetadata(filePath);
  } else {
    metadata = await extractEpubMetadata(filePath);
  }

  let coverFilename = `${bookId}.jpg`;

  if (fileType === 'pdf') {
    try {
      const { Poppler } = await import('node-poppler');
      const poppler = new Poppler();

      const coverDir = path.join(UPLOAD_DIR, 'covers');
      const outputPathPrefix = path.join(coverDir, `${bookId}`);

      const options = {
        jpegFile: true,
        singleFile: true,
        firstPageToConvert: 1,
        lastPageToConvert: 1
      };
      
      console.log(`[Debug] Attempting to generate cover for: ${filePath}`);
      await poppler.pdfToCairo(filePath, outputPathPrefix, options);
      coverFilename = `${bookId}.jpg`; 
      console.log(`[Debug] Cover generated successfully: ${coverFilename}`);
    } catch (err) {
      console.error("Cover generation failed:", err.message);
    }
  }

  try {
    console.log('[Debug] Creating book with user_id:', req.user._id);
    
    const newBook = new Book({
      user_id: req.user._id,
      title: req.body.title || metadata.title,
      file_name: originalname,
      file_type: fileType,
      file_path: `/uploads/books/${uniqueFilename}`,
      file_size: size,
      cover_image: `/uploads/covers/${coverFilename}`, 
      total_pages: metadata.total_pages || 0,
      category: req.body.category || 'menu_book',
    });
    
    console.log('[Debug] Saving book to database...');
    const savedBook = await newBook.save();
    console.log('[Debug] Book saved successfully with _id:', savedBook._id);
    
    res.status(200).json({ success: true, book: savedBook });
  } catch (error) {
    console.error('[Upload Error]:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/books
router.get('/', protect, async (req, res) => {
  const { status, search, sort } = req.query;
  let query = { user_id: req.user._id };

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

// GET /api/books/:id
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

// ✅ PUT /api/books/:id/progress - UPDATE PROGRESS
router.put('/:id/progress', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { current_page, total_pages } = req.body;

    // Validasi input
    if (!current_page || !total_pages) {
      return res.status(400).json({ 
        success: false, 
        error: "current_page and total_pages are required" 
      });
    }

    // Cari buku dan pastikan milik user yang login
    const book = await Book.findById(id);

    if (!book || book.user_id.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, error: "Book not found" });
    }

    // Hitung progress
    const progress = Math.round((current_page / total_pages) * 100);
    
    // Tentukan status berdasarkan progress
    let status = 'reading';
    if (progress >= 100) {
      status = 'completed';
    } else if (current_page === 1) {
      status = 'not-started';
    }

    // Update buku
    book.current_page = current_page;
    book.progress = progress;
    book.status = status;
    book.last_read = new Date();
    book.updated_at = new Date();

    await book.save();

    console.log(`[Progress] ${book.title}: Page ${current_page}/${total_pages} (${progress}%) - ${status}`);

    res.status(200).json({ 
      success: true, 
      book: book,
      message: "Progress updated successfully"
    });

  } catch (error) {
    console.error("[Progress Update Error]:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/books/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const book = await Book.findById(id);

    if (!book || book.user_id.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, error: "Book not found" });
    }

    const bookFilePath = path.join(__dirname, '..', book.file_path);
    const coverFilePath = path.join(__dirname, '..', book.cover_image);

    try {
      await fs.unlink(bookFilePath);
      await fs.unlink(coverFilePath);
      console.log(`[Debug] Deleted files: ${book.file_path} & ${book.cover_image}`);
    } catch (fileErr) {
      console.warn(`Could not delete file: ${fileErr.message}`);
    }

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
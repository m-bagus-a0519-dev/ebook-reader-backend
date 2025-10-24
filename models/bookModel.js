const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  // _id dibuat otomatis oleh MongoDB
  _id: { type: String, required: true }, // <-- TAMBAHKAN BARIS INI
  title: { type: String, required: true },
  file_name: { type: String, required: true },
  file_type: { type: String, enum: ['pdf', 'epub'], required: true },
  file_path: { type: String, required: true },
  file_size: { type: Number, required: true },
  cover_image: { type: String, required: true },
  category: { type: String, default: "menu_book" },
  total_pages: { type: Number, required: true },
  status: {
    type: String,
    enum: ["not-started", "reading", "completed"],
    default: "not-started"
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  current_page: { type: Number, default: 1 },
  last_read: { type: Date },
  uploaded_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Book', bookSchema);
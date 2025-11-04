require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const session = require('express-session');


// --- folder cloudinary ---
const cloudinary = require('cloudinary').v2;

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// --- 1. Impor Rute ---
const bookRoutes = require('./routes/bookRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 8001;

// --- 2. Atur View Engine (EJS) ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- 3. Atur Middleware (Urutan Sangat Penting) ---

// (A) Middleware Global (CORS, Body Parsers)
// Ini harus dijalankan pertama
app.use(cors());
app.use(express.json()); // Untuk API React (JSON)
app.use(express.urlencoded({ extended: true })); // Untuk Form Admin (EJS)

// (B) Middleware Sesi (HARUS SEBELUM RUTE ADMIN)
app.use(session({
  secret: process.env.SESSION_SECRET || 'ganti_ini_dengan_rahasia_lain',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false, // Set 'true' jika Anda menggunakan HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 // 1 jam
  } 
}));

// (C) Sajikan File Statis (Uploads)
//app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// --- 4. Gunakan Rute (HARUS SETELAH SEMUA MIDDLEWARE) ---
app.use('/api/books', bookRoutes);
app.use('/api/auth', authRoutes);
app.use('/admin', adminRoutes); 


// --- 5. Koneksi DB dan Jalankan Server ---
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}).catch(err => console.error('Could not connect to MongoDB', err));
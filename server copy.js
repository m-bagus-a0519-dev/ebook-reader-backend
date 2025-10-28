require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bookRoutes = require('./routes/bookRoutes');
const authRoutes = require('./routes/authRoutes');
const session = require('express-session'); // <-- 1. IMPOR SESSION

const app = express();
const PORT = process.env.PORT || 8001;
// Impor Rute


const adminRoutes = require('./routes/adminRoutes'); // <-- 2. IMPOR RUTE ADMIN (akan kita buat)

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // <-- TAMBAHKAN BARIS INI


// Sajikan file statis (cover & buku) dari direktori uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/books', bookRoutes);  // Untuk React App
app.use('/api/auth', authRoutes); // Untuk React App
app.use('/admin', adminRoutes);     // <-- 6. GUNAKAN RUTE ADMIN


// --- KONFIGURASI BARU ---

// 3. Atur EJS sebagai View Engine
app.set('view engine', 'ejs');
// Beri tahu Express di mana folder 'views' berada
app.set('views', path.join(__dirname, 'views'));

// 4. Middleware untuk membaca data form (dari form login admin)
app.use(express.urlencoded({ extended: true }));

// 5. Middleware untuk Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'ganti_ini_dengan_rahasia_lain', // Ganti ini!
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false, // Set 'true' jika Anda menggunakan HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 // 1 jam
  } 
}));
// -------------------------

// Middleware (yang sudah ada)
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Koneksi ke MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}).catch(err => console.error('Could not connect to MongoDB', err));
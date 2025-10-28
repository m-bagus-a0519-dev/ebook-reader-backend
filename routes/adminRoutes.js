// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const bcrypt = require('bcryptjs'); // Kita butuh ini untuk membandingkan pass admin

// --- MIDDLEWARE PENJAGA ADMIN ---
// Ini akan melindungi dashboard
const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    // Jika user adalah admin, lanjutkan
    next();
  } else {
    // Jika bukan, tendang ke halaman login
    res.redirect('/admin/login');
  }
};

// --- RUTE LOGIN ADMIN ---

// GET /admin/login
// Menampilkan halaman login EJS
router.get('/login', (req, res) => {
  // 'login' merujuk ke file 'views/login.ejs'
  res.render('login', { error: null }); 
});

// POST /admin/login
// Memproses percobaan login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email, role: 'admin' }).select('+password');

    if (user && (await user.comparePassword(password))) {
      // Password benar & dia adalah admin
      req.session.isAdmin = true; // Set sesi
      req.session.adminEmail = user.email;
      res.redirect('/admin/dashboard');
    } else {
      // Gagal login
      res.render('login', { error: 'Invalid credentials or not an admin' });
    }
  } catch (error) {
    res.render('login', { error: 'Server error' });
  }
});

// GET /admin/logout
router.get('/logout', (req, res) => {
  req.session.destroy(); // Hapus sesi
  res.redirect('/admin/login');
});


// --- RUTE DASHBOARD (DILINDUNGI) ---

// GET /admin/dashboard
// 'isAdmin' akan berjalan dulu sebelum menampilkan dashboard
router.get('/dashboard', isAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.render('dashboard', { 
      users: users, 
      adminEmail: req.session.adminEmail 
    });
  } catch (error) {
    res.render('dashboard', { users: [], error: 'Failed to fetch users' });
  }
});

// POST /admin/users/add (dari form di dashboard)
router.post('/users/add', isAdmin, async (req, res) => {
  const { email, password, role } = req.body;
  
  if (!email || !password || !role) {
    // Seharusnya ada validasi yang lebih baik, tapi ini cukup
    return res.redirect('/admin/dashboard?error=All fields are required');
  }

  try {
    await User.create({ email, password, role });
    res.redirect('/admin/dashboard');
  } catch (error) {
    res.redirect(`/admin/dashboard?error=${error.message}`);
  }
});

// POST /admin/users/delete/:id (dari tombol di dashboard)
// Kita pakai POST untuk delete agar lebih aman daripada GET
router.post('/users/delete/:id', isAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin/dashboard');
  } catch (error) {
    res.redirect(`/admin/dashboard?error=${error.message}`);
  }
});

module.exports = router;
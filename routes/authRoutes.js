// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // 1. Validasi input
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Please provide email and password' });
  }

  try {
    // 2. Cari user berdasarkan email (minta password-nya juga)
    const user = await User.findOne({ email }).select('+password');

    // 3. Cek apakah user ada DAN password-nya cocok
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // 4. Jika sukses, buat Token (JWT)
    const token = jwt.sign(
      { id: user._id, role: user.role }, // Payload token
      process.env.JWT_SECRET,            // Kunci rahasia (dari .env)
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' } // Waktu kadaluarsa
    );

    // 5. Kirim token ke client
    res.status(200).json({
      success: true,
      token
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
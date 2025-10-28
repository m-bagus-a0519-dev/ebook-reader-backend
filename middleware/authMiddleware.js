// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

exports.protect = async (req, res, next) => {
  let token;

  // 1. Cek apakah token ada di header 'Authorization'
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 2. Ambil token (formatnya: "Bearer <token>")
      token = req.headers.authorization.split(' ')[1];

      // 3. Verifikasi token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 4. Cari user di DB dan tempelkan ID-nya ke 'req'
      // Kita tambahkan .select('-password') agar password tidak ikut
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'User not found' });
      }

      // 5. Lanjutkan ke rute berikutnya
      next();
    } catch (error) {
      return res.status(401).json({ success: false, error: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authorized, no token' });
  }
};
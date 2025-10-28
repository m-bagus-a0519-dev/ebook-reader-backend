// seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/userModel');

// --- KONFIGURASI ---
// Atur email dan password untuk admin dan user pertama Anda
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin_password_123'; // Ganti dengan password aman

const USER_EMAIL = 'user@example.com';
const USER_PASSWORD = 'user_password_123';   // Ganti dengan password aman
// --------------------

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Terhubung ke MongoDB untuk seeding...');

    // 1. Buat Admin
    // Cek dulu jika admin sudah ada
    let admin = await User.findOne({ email: ADMIN_EMAIL });
    if (!admin) {
      admin = await User.create({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role: 'admin'
      });
      console.log(`User admin dibuat: ${admin.email}`);
    } else {
      console.log(`User admin sudah ada: ${admin.email}`);
    }

    // 2. Buat User
    let user = await User.findOne({ email: USER_EMAIL });
    if (!user) {
      user = await User.create({
        email: USER_EMAIL,
        password: USER_PASSWORD,
        role: 'user'
      });
      console.log(`User biasa dibuat: ${user.email}`);
    } else {
      console.log(`User biasa sudah ada: ${user.email}`);
    }

    console.log('\nSeeding selesai! ✨');

  } catch (error) {
    console.error('Error saat seeding database:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Terputus dari MongoDB.');
  }
};

seedUsers();
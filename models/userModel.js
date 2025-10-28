// models/userModel.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true, // Email tidak boleh sama
    lowercase: true,
    trim: true 
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'], 
    minlength: 6,
    select: false // Password tidak akan ikut terkirim saat query user
  },
  role: { 
    type: String, 
    enum: ['user', 'admin'], // Hanya boleh diisi 'user' atau 'admin'
    default: 'user' 
  }
});

// Fungsi ini berjalan OTOMATIS sebelum user disimpan
// Ini akan meng-enkripsi password
userSchema.pre('save', async function(next) {
  // Hanya hash password jika baru atau dimodifikasi
  if (!this.isModified('password')) return next();

  // Hashing password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Fungsi ini kita buat untuk membandingkan password saat login
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
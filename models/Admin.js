const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  nombre: String,
  rol: { type: String, enum: ['admin_saas'], default: 'admin_saas' }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);

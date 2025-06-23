const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  nombre: String,
  telefono: { type: String, required: true, unique: true },
  email: String,
  verificado: { type: Boolean, default: false },
  creadoEn: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Usuario', UsuarioSchema);
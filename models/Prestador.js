const mongoose = require('mongoose');

const SuscripcionSchema = new mongoose.Schema({
  estado: { type: String, enum: ['activo', 'suspendido', 'cancelado'], default: 'activo' },
  plan: { type: String, enum: ['free', 'pro', 'premium'], default: 'free' },
  vencimiento: Date
});

const PrestadorSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },  // Para URL → ej: /[nombre]
  nombreComercial: { type: String, required: true },
  telefono: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, 
  rol: { type: String, enum: ['admin', 'user', 'prestador'], default: 'prestador' },              
  direccion: String,
  suscripcion: SuscripcionSchema,
  creadoEn: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Prestador', PrestadorSchema);

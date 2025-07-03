const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  telefono: { type: String, required: true },
  email: String,
  passwordHash: String,
  fidelizacion: {
    puntos: { type: Number, default: 0 },
    beneficios: [String]
  },
  eliminado: { type: Boolean, default: false }
}, { timestamps: true });

clienteSchema.index({ telefono: 1 });

module.exports = mongoose.model('Cliente', clienteSchema);

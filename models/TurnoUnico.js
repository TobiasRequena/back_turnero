const mongoose = require('mongoose');

const TurnoSchema = new mongoose.Schema({
  prestador: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestador', required: true },
  empleado: { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', required: true },  // ← OBLIGATORIO ahora
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  servicio: {
    nombre: { type: String, required: true },
    precio: { type: Number, required: true }
  },
  fecha: { type: String, required: true },  // "YYYY-MM-DD"
  hora: { type: String, required: true },   // "HH:mm"
  estado: { type: String, enum: ['pendiente', 'confirmado', 'cancelado'], default: 'pendiente' },
  creadoEn: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Turno', TurnoSchema);
const mongoose = require('mongoose');

const suscripcionSchema = new mongoose.Schema({
  prestadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestador', required: true, unique: true },
  plan: { type: String, enum: ['gratuito', 'basico', 'premium'], required: true },
  inicio: { type: Date, required: true },
  fin: { type: Date, required: true },
  estado: { type: String, enum: ['activa', 'vencida', 'suspendida'], default: 'activa' },
  limites: {
    maxTurnosMensuales: Number,
    maxEmpleados: Number,
    maxServicios: Number,
    funcionesExtra: [String]
  },
  renovacionAutomatica: { type: Boolean, default: false },
  ultimaRenovacion: Date
}, { timestamps: true });

module.exports = mongoose.model('Suscripcion', suscripcionSchema);

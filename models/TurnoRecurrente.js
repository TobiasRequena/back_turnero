const mongoose = require('mongoose');

const turnoRecurrenteSchema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  prestadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestador', required: true },
  empleadoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado' },
  servicioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Servicio', required: true },
  diaSemana: { type: Number, min: 0, max: 6, required: true }, // 0 = domingo
  hora: { type: String, required: true }, // "10:30"
  desde: { type: Date },
  hasta: { type: Date },
  observaciones: String,
  activo: { type: Boolean, default: true },
  eliminado: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('TurnoRecurrente', turnoRecurrenteSchema);

const mongoose = require('mongoose');

const turnoSchema = new mongoose.Schema({
  fecha: { type: Date, required: true },
  horaInicio: { type: String, required: true }, // "09:30"
  horaFin: { type: String, required: true },    // "10:00"
  clienteNombre: { type: String, required: true },
  clienteTelefono: { type: String, required: true },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' }, // opcional
  prestadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestador', required: true },
  empleadoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado' }, // opcional
  servicioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Servicio', required: true },
  estado: { type: String, enum: ['pendiente', 'confirmado', 'cancelado'], default: 'pendiente' },
  origen: { type: String, enum: ['cliente', 'manual'], default: 'cliente' },
  esExcepcionDeRecurrente: { type: Boolean, default: false },
  duracionFinal: Number,
  precioFinal: Number,
  eliminado: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Turno', turnoSchema);

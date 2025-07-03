const mongoose = require('mongoose');

const historialPrecioSchema = new mongoose.Schema({
  fechaDesde: Date,
  duracionMinutos: Number,
  precio: Number
}, { _id: false });

const servicioSchema = new mongoose.Schema({
  prestadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestador', required: true },
  nombre: { type: String, required: true },
  descripcion: String,
  duracionMinutos: { type: Number, required: true },
  precio: { type: Number, required: true },
  historial: [historialPrecioSchema],
  activo: { type: Boolean, default: true },
  eliminado: { type: Boolean, default: false }
});

module.exports = mongoose.model('Servicio', servicioSchema);

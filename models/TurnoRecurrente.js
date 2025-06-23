const mongoose = require('mongoose');

const TurnoRecurrenteSchema = new mongoose.Schema({
  prestador: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestador', required: true },
  empleado: { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado' },   // Opcional si se quiere turno fijo con empleado
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  servicio: {
    nombre: { type: String, required: true },
    precio: { type: Number, required: true }
  },
  diaSemana: {
    type: String,
    enum: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
    required: true
  },
  hora: { type: String, required: true },     // Ej: "19:00"
  estado: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
  creadoEn: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TurnoRecurrente', TurnoRecurrenteSchema);
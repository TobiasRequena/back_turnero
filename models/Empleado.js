const mongoose = require('mongoose');

const HorarioIntervaloSchema = new mongoose.Schema({
  apertura: { type: String, required: true },  // Ej: "09:00"
  cierre: { type: String, required: true }     // Ej: "12:00"
});

const HorarioDiaSchema = new mongoose.Schema({
  dia: {
    type: String,
    enum: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
    required: true
  },
  intervalos: [HorarioIntervaloSchema]
});

const ServicioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  descripcion: String,
  precio: { type: Number, required: true },
  horarios: [HorarioDiaSchema]   // Opcional: si un servicio tiene horarios propios distintos del empleado
});

const EmpleadoSchema = new mongoose.Schema({
  prestador: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestador', required: true },
  nombre: { type: String, required: true },
  esPropietario: { type: Boolean, default: false },
  especialidad: String,        // Ej: "Cortes", "Uñas", "Barbería"
  telefono: String,            // Opcional
  horarios: [HorarioDiaSchema], // Horarios generales del empleado
  servicios: [ServicioSchema], // Servicios propios del empleado
  creadoEn: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Empleado', EmpleadoSchema);
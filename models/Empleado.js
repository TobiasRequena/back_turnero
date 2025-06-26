const mongoose = require('mongoose');

const disponibilidadSchema = new mongoose.Schema({
  diaSemana: { type: Number, min: 0, max: 6 },
  bloques: [
    {
      desde: String, // "09:00"
      hasta: String  // "12:00"
    }
  ]
}, { _id: false });

const empleadoSchema = new mongoose.Schema({
  prestadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestador', required: true },
  nombre: { type: String, required: true },
  telefono: String,
  email: String,
  passwordHash: String,
  servicios: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Servicio' }],
  disponibilidad: [disponibilidadSchema],
  activo: { type: Boolean, default: true },
  eliminado: { type: Boolean, default: false }
});

module.exports = mongoose.model('Empleado', empleadoSchema);

const mongoose = require('mongoose');

const horarioSchema = new mongoose.Schema({
  prestadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestador', required: true },
  empleadoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', default: null },
  diaSemana: {
    type: String,
    enum: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
    required: true
  },
  bloques: [
    {
      desde: { type: String, required: true }, // formato "HH:mm"
      hasta: { type: String, required: true }
    }
  ],
  eliminado: { type: Boolean, default: false },
  creadoEn: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Horario', horarioSchema);

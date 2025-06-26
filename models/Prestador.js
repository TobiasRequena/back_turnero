const mongoose = require('mongoose');

const disponibilidadSchema = new mongoose.Schema({
  diaSemana: { type: Number, min: 0, max: 6 },
  bloques: [
    {
      desde: String,
      hasta: String
    }
  ]
}, { _id: false });

const prestadorSchema = new mongoose.Schema({
  nombreComercial: { type: String, required: true },
  nombreUrl: { type: String, unique: true, required: true },
  email: String,
  telefono: String,
  direccion: String,
  rubro: String,
  passwordHash: String,
  plan: String,
  servicios: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Servicio' }],
  disponibilidad: [disponibilidadSchema],
  activo: { type: Boolean, default: true },
  eliminado: { type: Boolean, default: false }
});

module.exports = mongoose.model('Prestador', prestadorSchema);

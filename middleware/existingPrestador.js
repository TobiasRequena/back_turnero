const Prestador = require('../models/Prestador'); // ajustá el path si es necesario
const mongoose = require('mongoose');

const verificarPrestadorExiste = async (req, res, next) => {
  try {
    const prestadorId = req.params.id || req.body.prestadorId;

    if (!prestadorId || !mongoose.Types.ObjectId.isValid(prestadorId)) {
      return res.status(400).json({ mensaje: 'ID de prestador inválido o no proporcionado' });
    }

    const prestador = await Prestador.findById(prestadorId);

    if (!prestador || prestador.eliminado) {
      return res.status(404).json({ mensaje: 'Prestador no encontrado' });
    }

    // Podés adjuntarlo al request si lo necesitás más adelante
    req.prestador = prestador;

    next();
  } catch (error) {
    console.error('Error al verificar prestador:', error);
    res.status(500).json({ mensaje: 'Error del servidor al verificar el prestador' });
  }
};

module.exports = verificarPrestadorExiste;

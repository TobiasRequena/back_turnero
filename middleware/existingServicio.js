const mongoose = require('mongoose');
const Servicio = require('./models/Servicios');

const verificarServicioExiste = async (req, res, next) => {
  const servicioId = req.params.id || req.body.servicioId;

  if (!servicioId || !mongoose.Types.ObjectId.isValid(servicioId)) {
    return res.status(400).json({ msg: 'ID de servicio inválido o no proporcionado' });
  }

  try {
    const servicio = await Servicio.findById(servicioId);

    if (!servicio || servicio.eliminado) {
      return res.status(404).json({ msg: 'Empleado no encontrado' });
    }

    req.servicio = servicio;
    next();
  } catch (error) {
    console.error('Error al verificar servicio:', error);
    res.status(500).json({ msg: 'Error interno del servidor al verificar servicio' });
  }
};

module.exports = verificarServicioExiste;

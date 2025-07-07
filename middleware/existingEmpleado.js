const mongoose = require('mongoose');
const Empleado = require('./models/Empleado');

const verificarEmpleadoExiste = async (req, res, next) => {
  const empleadoId = req.params.id || req.body.empleadoId;

  if (!empleadoId || !mongoose.Types.ObjectId.isValid(empleadoId)) {
    return res.status(400).json({ msg: 'ID de empleado inválido o no proporcionado' });
  }

  try {
    const empleado = await Empleado.findById(empleadoId);

    if (!empleado || empleado.eliminado) {
      return res.status(404).json({ msg: 'Empleado no encontrado' });
    }

    req.empleado = empleado;
    next();
  } catch (error) {
    console.error('Error al verificar empleado:', error);
    res.status(500).json({ msg: 'Error interno del servidor al verificar empleado' });
  }
};

module.exports = verificarEmpleadoExiste;

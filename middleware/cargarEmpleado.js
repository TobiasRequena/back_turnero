// middlewares/cargarEmpleado.js
const Empleado = require('./models/Empleado');

const cargarEmpleado = async (req, res, next) => {
  const empleadoId = req.body.empleadoId || req.query.empleadoId;
  if (empleadoId) {
    try {
      const empleado = await Empleado.findById(empleadoId).select('nombre email telefono');
      if (!empleado) return res.status(404).json({ msg: 'Empleado no encontrado' });
      req.empleadoInfo = empleado; // lo adjuntamos al request
    } catch (err) {
      return res.status(500).json({ msg: 'Error al buscar empleado', error: err.message });
    }
  }
  next();
};

module.exports = cargarEmpleado;

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Servicio = require('../models/Servicios');
const authenticateJWT = require('../middleware/authenticateJWT');
const verifyRole = require('../middleware/verifyRole');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('[servicios] Mongo conectado'))
  .catch(err => console.error('Mongo error:', err));

// ✅ Crear servicio
app.post('/servicios', authenticateJWT, verifyRole('admin', 'prestador'), async (req, res) => {
  try {
    const { nombre, descripcion, duracionMinutos, precio } = req.body;
    const prestadorId = req.user.id; // Obtener el ID del prestador del token JWT

    // 1. Verificar si ya existe un servicio con el mismo nombre para este prestador
    const servicioExistente = await Servicio.findOne({
      prestadorId: prestadorId,
      nombre: nombre,
      eliminado: false
    });

    if (servicioExistente) {
      return res.status(409).json({
        msg: 'Ya existe un servicio con este nombre para tu negocio. Por favor, elige un nombre diferente o edita el servicio existente.',
        servicioExistente: servicioExistente
      });
    }

    // 2. Si no existe, proceder con la creación del nuevo servicio
    const nuevo = await Servicio.create({
      prestadorId: prestadorId,
      nombre,
      descripcion,
      duracionMinutos,
      precio
    });

    res.status(201).json({ msg: 'Servicio creado exitosamente.', servicio: nuevo });
  } catch (err) {
    console.error('Error al crear servicio:', err); // Para depuración
    res.status(500).json({ msg: 'Hubo un error al crear el servicio. Por favor, inténtalo de nuevo.', error: err.message });
  }
});

// ✅ Obtener todos los servicios del prestador
app.get('/servicios', authenticateJWT, verifyRole('admin', 'prestador'), async (req, res) => {
  try {
    const servicios = await Servicio.find({ prestadorId: req.user.id, eliminado: false });
    res.json({ total: servicios.length, servicios });
  } catch (err) {
    res.status(500).json({ msg: 'Error al obtener servicios', error: err.message });
  }
});

// ✅ Editar un servicio
app.patch('/servicios/:id', authenticateJWT, verifyRole('admin', 'prestador'), async (req, res) => {
  try {
    const { id } = req.params;
    const actualizaciones = req.body;

    const servicio = await Servicio.findOneAndUpdate(
      { _id: id, prestadorId: req.user.id },
      actualizaciones,
      { new: true }
    );

    if (!servicio) return res.status(404).json({ msg: 'Servicio no encontrado' });

    res.json({ msg: 'Servicio actualizado', servicio });
  } catch (err) {
    res.status(500).json({ msg: 'Error al editar servicio', error: err.message });
  }
});

// ✅ Soft delete de servicio
app.delete('/servicios/:id', authenticateJWT, verifyRole('admin', 'prestador'), async (req, res) => {
  try {
    const { id } = req.params;

    const servicio = await Servicio.findOneAndUpdate(
      { _id: id, prestadorId: req.user.id },
      { eliminado: true },
      { new: true }
    );

    if (!servicio) return res.status(404).json({ msg: 'Servicio no encontrado' });

    res.json({ msg: 'Servicio eliminado' });
  } catch (err) {
    res.status(500).json({ msg: 'Error al eliminar servicio', error: err.message });
  }
});

const PORT = process.env.PORT_SERVICIOS || 3002;
app.listen(PORT, () => {
  console.log(`[servicios] Microservicio corriendo en http://localhost:${PORT}`);
});

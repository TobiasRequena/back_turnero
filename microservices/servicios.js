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

app.post('/api/servicios', authenticateJWT, verifyRole('admin', 'prestador'), async (req, res) => {
  try {
    const serviciosACrear = req.body;
    const prestadorId = req.user.id;

    if (!Array.isArray(serviciosACrear) || serviciosACrear.length === 0) {
      return res.status(400).json({ msg: 'El cuerpo de la solicitud debe ser un array de servicios no vacío.' });
    }

    const serviciosCreados = [];
    const erroresCreacion = [];

    for (const servicioData of serviciosACrear) {
      const { nombre, descripcion, duracionMinutos, precio } = servicioData;

      const servicioExistente = await Servicio.findOne({
        prestadorId: prestadorId,
        nombre: nombre,
        eliminado: false
      });

      if (servicioExistente) {
        erroresCreacion.push({
          nombre: nombre,
          msg: 'Ya existe un servicio con este nombre para tu negocio.',
          servicioExistente: servicioExistente
        });
      } else {
        try {
          const nuevo = await Servicio.create({
            prestadorId: prestadorId,
            nombre,
            descripcion,
            duracionMinutos,
            precio
          });
          serviciosCreados.push(nuevo);
        } catch (creationError) {
          erroresCreacion.push({
            nombre: nombre,
            msg: 'Error al crear el servicio individual.',
            error: creationError.message
          });
        }
      }
    }

    if (serviciosCreados.length > 0 && erroresCreacion.length === 0) {
      res.status(201).json({ msg: 'Servicios creados exitosamente.', servicios: serviciosCreados });
    } else if (serviciosCreados.length > 0 && erroresCreacion.length > 0) {
      res.status(207).json({ 
        msg: 'Algunos servicios fueron creados, pero hubo errores con otros.',
        serviciosCreados: serviciosCreados,
        errores: erroresCreacion
      });
    } else {
      res.status(400).json({ msg: 'No se pudo crear ningún servicio.', errores: erroresCreacion });
    }

  } catch (err) {
    console.error('Error general al crear servicios:', err);
    res.status(500).json({ msg: 'Hubo un error inesperado al procesar la solicitud.', error: err.message });
  }
});

// ✅ Obtener todos los servicios del prestador
app.get('/api/servicios', authenticateJWT, verifyRole('admin', 'prestador'), async (req, res) => {
  try {
    const servicios = await Servicio.find({ prestadorId: req.user.id, eliminado: false });
    res.json({ total: servicios.length, servicios });
  } catch (err) {
    res.status(500).json({ msg: 'Error al obtener servicios', error: err.message });
  }
});

// ✅ Editar un servicio
app.patch('/api/servicios/:id', authenticateJWT, verifyRole('admin', 'prestador'), async (req, res) => {
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
app.delete('/api/servicios/:id', authenticateJWT, verifyRole('admin', 'prestador'), async (req, res) => {
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

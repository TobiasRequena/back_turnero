require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Horario = require('../models/Horario');
const authenticateJWT = require('../middleware/authenticateJWT');

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('[horarios] Mongo conectado'))
  .catch(err => console.error('Mongo error:', err));

// 📌 Crear horario disponible
app.post('/api/horaios', authenticateJWT, async (req, res) => {
  try {
    const { diaSemana, bloques, empleadoId } = req.body;
    console.log('Crear horario:', req.user);

    const nuevo = await Horario.create({
      prestadorId: req.user.tipo === 'empleado' ? req.user.prestadorId : req.user.id,
      empleadoId: empleadoId || null,
      diaSemana,
      bloques
    });

    res.status(201).json({ msg: 'Horario creado', horario: nuevo });
  } catch (err) {
    res.status(500).json({ msg: 'Error al crear horario', error: err.message });
  }
});

// 📌 Obtener todos los horarios del prestador (o empleado)
app.get('/api/horaios', authenticateJWT, async (req, res) => {
  try {
    const filtros = { prestadorId: req.user.id, eliminado: false };

    if (req.query.empleadoId) {
      filtros.empleadoId = req.query.empleadoId;
    }

    const horarios = await Horario.find(filtros);
    res.json({ total: horarios.length, horarios });
  } catch (err) {
    res.status(500).json({ msg: 'Error al obtener horarios', error: err.message });
  }
});

// 📌 Editar horario
app.patch('/api/horaios/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const actualizaciones = req.body;

    const horario = await Horario.findOneAndUpdate(
      { _id: id, prestadorId: req.user.id },
      actualizaciones,
      { new: true }
    );

    if (!horario) return res.status(404).json({ msg: 'Horario no encontrado' });

    res.json({ msg: 'Horario actualizado', horario });
  } catch (err) {
    res.status(500).json({ msg: 'Error al editar horario', error: err.message });
  }
});

// 📌 Eliminar (soft delete)
app.delete('/api/horaios/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const horario = await Horario.findOneAndUpdate(
      { _id: id, prestadorId: req.user.id },
      { eliminado: true },
      { new: true }
    );

    if (!horario) return res.status(404).json({ msg: 'Horario no encontrado' });

    res.json({ msg: 'Horario eliminado' });
  } catch (err) {
    res.status(500).json({ msg: 'Error al eliminar horario', error: err.message });
  }
});

// 🔥 Iniciar servicio
const PORT = process.env.PORT_HORARIOS || 3003;
app.listen(PORT, () => {
  console.log(`[horarios] Microservicio corriendo en http://localhost:${PORT}`);
});

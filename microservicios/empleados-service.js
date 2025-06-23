require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

//Modelos
const Empleado = require('../models/Empleado');
const Prestador = require('../models/Prestador');

//Middleware
const authenticateJWT = require('../middleware/authenticateJWT');

const PORT = process.env.EMPLOYES_PORT || 4003;
const MONGO_URI = process.env.MONGO_URI;

const app = express();
app.use(express.json());

// Conectar a MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('[empleados-service] MongoDB conectado'))
  .catch(err => console.error('Error MongoDB:', err));

// Crear un nuevo empleado
app.post('/empleado', authenticateJWT, async (req, res) => {
  try {
    const { prestador, nombre, especialidad, telefono, horarios, servicios } = req.body;

    if (!prestador || !nombre) return res.status(400).json({ message: 'Faltan datos obligatorios' });

    const nuevoEmpleado = new Empleado({
      prestador,
      nombre,
      especialidad,
      telefono,
      horarios,
      servicios
    });

    const guardado = await nuevoEmpleado.save();

    res.status(201).json({ message: 'Empleado creado', empleado: guardado });
  } catch (err) {
    res.status(500).json({ message: 'Error al crear empleado', error: err.message });
  }
});

// Obtener todos los empleados de un prestador
app.get('/empleados/:prestadorId', authenticateJWT, async (req, res) => {
  try {
    const empleados = await Empleado.find({ prestador: req.params.prestadorId });
    res.json(empleados);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener empleados', error: err.message });
  }
});

// Actualizar horarios del empleado
app.patch('/empleado/:id/horarios', authenticateJWT, async (req, res) => {
  try {
    const { horarios } = req.body;
    const empleado = await Empleado.findByIdAndUpdate(req.params.id, { horarios }, { new: true });
    res.json({ message: 'Horarios actualizados', empleado });
  } catch (err) {
    res.status(500).json({ message: 'Error al actualizar horarios', error: err.message });
  }
});

// Actualizar servicios del empleado
app.patch('/empleado/:id/servicios', authenticateJWT, async (req, res) => {
  try {
    const { servicios } = req.body;
    const empleado = await Empleado.findByIdAndUpdate(req.params.id, { servicios }, { new: true });
    res.json({ message: 'Servicios actualizados', empleado });
  } catch (err) {
    res.status(500).json({ message: 'Error al actualizar servicios', error: err.message });
  }
});

// Eliminar empleado
app.delete('/empleado/:id', authenticateJWT, async (req, res) => {
  try {
    await Empleado.findByIdAndDelete(req.params.id);
    res.json({ message: 'Empleado eliminado' });
  } catch (err) {
    res.status(500).json({ message: 'Error al eliminar empleado', error: err.message });
  }
});

// Obtener todos los empleados de todos los prestadores
app.get('/empleados/prestador/todos', authenticateJWT, async (req, res) => {
  try {
    const prestadores = await Prestador.find().select('nombre nombreComercial');

    const resultado = await Promise.all(
      prestadores.map(async (prestador) => {
        const empleados = await Empleado.find({ prestador: prestador._id });
        return {
          prestador,
          empleados
        };
      })
    );

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener empleados', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[empleados-service] Corriendo en http://localhost:${PORT}`);
});

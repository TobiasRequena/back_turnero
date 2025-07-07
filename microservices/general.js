require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Models
const Prestador = require('../models/Prestador');
const Cliente = require('../models/Cliente');
const Servicio = require('../models/Servicios');
const Empleado = require('../models/Empleado');
const Admin = require('../models/Admin');

// Middleware
const verifyRole = require('../middleware/verifyRole');
const authenticateJWT = require('../middleware/authenticateJWT');
const verificarPrestadorExiste = require('../middleware/existingPrestador');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/general/:prestador', async (req, res) => {
  const { prestador } = req.params;

  if (!prestador) {
    return res.status(400).json({ msg: 'Falta el parámetro prestador' });
  }

  try {
    const user = await Prestador.findOne({ nombreUrl: prestador }).select('-passwordHash');;

    if (!user) {
      return res.status(404).json({ msg: 'Prestador no encontrado' });
    }

    res.json({ msg: 'Bienvenido al microservicio general', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error interno del servidor' });
  }
});

app.get('/api/general/empleados/:IdPrestador', async (req, res) => {
  const { IdPrestador } = req.params;

  if (!IdPrestador) {
    return res.status(400).json({ msg: 'Falta el parámetro IdPrestador' });
  }

  try {
    const empleados = await Empleado.find({ prestadorId: IdPrestador, eliminado: false }).select('-passwordHash');
      // .populate('prestadorId', 'nombreComercial nombreUrl');

    if (empleados.length === 0) {
      return res.json({ msg: 'No se encontraron empleados para este prestador', empleados});
    }

    res.json({empleados: empleados});
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error interno del servidor' });
  }
})

app.get('/api/general/prestador/servicios/:IdPrestador', async (req, res) => {
  const { IdPrestador } = req.params;

  try {
    const servicios = await Servicio.find({ prestadorId: IdPrestador, eliminado: false });
    res.json({ total: servicios.length, servicios });
  } catch (err) {
    res.status(500).json({ msg: 'Error al obtener servicios', error: err.message });
  }  
})

// 🔗 Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('[gral] Mongo conectado'))
  .catch(err => console.error('Mongo error:', err));

// ===============================
// 🚀 Iniciar microservicio
// ===============================
const PORT = process.env.PORT_GRAL || 3005;
app.listen(PORT, () => {
  console.log(`[gral] Microservicio corriendo en http://localhost:${PORT}`);
});
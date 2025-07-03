require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Models
const Prestador = require('../models/Prestador');
const Cliente = require('../models/Cliente');
const Empleado = require('../models/Empleado');
const Admin = require('../models/Admin');

//Middleware
const verifyRole = require('../middleware/verifyRole');
const authenticateJWT = require('../middleware/authenticateJWT');

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 Conexión a MongoDB
const PORT = process.env.PORT_AUTH || 3001;

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 60000,
  socketTimeoutMS: 120000
})
  .then(() => {
    console.log('[auth] Mongo conectado');
    app.listen(PORT, () => {
      console.log(`[auth] Microservicio corriendo en http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Error al conectar con MongoDB:', err);
    process.exit(1); // Salí del proceso si no se puede conectar
  });


// 🔐 Generar token
function generarToken(usuario, tipo) {
    const payload = {
        id: usuario._id,
        tipo,
        nombre: usuario.nombre || usuario.nombreComercial || '',
    };

    // Add prestadorId to the token if the user is an employee
    if (tipo === 'empleado' && usuario.prestadorId) {
        payload.prestadorId = usuario.prestadorId;
    }

    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// ===============================
// 📥 Registro de Prestador
// ===============================
app.post('/api/auth/registro/prestador', async (req, res) => {
  try {
    const { nombreComercial, nombreUrl, email, telefono, password } = req.body;

    if (!nombreComercial || !nombreUrl || !email || !telefono || !password) {
      return res.status(400).json({ msg: 'Todos los campos son obligatorios' });
    }

    const yaExiste = await Prestador.findOne({ $or: [{ email }, { nombreUrl }] });
    if (yaExiste) {
      return res.status(409).json({ msg: 'Ya existe un prestador con ese email o URL' });
    }

    const hash = await bcrypt.hash(password, 10);
    const nuevo = await Prestador.create({
      nombreComercial,
      nombreUrl,
      email,
      telefono,
      passwordHash: hash
    });

    res.status(201).json({
      msg: 'Prestador registrado correctamente',
      prestador: {
        id: nuevo._id,
        nombreComercial: nuevo.nombreComercial,
        nombreUrl: nuevo.nombreUrl,
        email: nuevo.email,
        telefono: nuevo.telefono
      }
    });
  } catch (err) {
    res.status(500).json({ msg: 'Error al registrar prestador', error: err.message });
  }
});

// ===============================
// 📥 Registro de Cliente básico
// ===============================
app.post('/api/auth/registro/cliente', async (req, res) => {
  try {
    const { nombre, telefono } = req.body;

    if (!nombre || !telefono) {
      return res.status(400).json({ msg: 'Nombre y teléfono son obligatorios' });
    }

    let cliente = await Cliente.findOne({ telefono });

    if (cliente) {
      return res.status(200).json({
        msg: 'Cliente ya registrado previamente',
        cliente: {
          id: cliente._id,
          nombre: cliente.nombre,
          telefono: cliente.telefono
        }
      });
    }

    cliente = await Cliente.create({ nombre, telefono });

    res.status(201).json({
      msg: 'Cliente registrado correctamente',
      cliente: {
        id: cliente._id,
        nombre: cliente.nombre,
        telefono: cliente.telefono
      }
    });
  } catch (err) {
    res.status(500).json({ msg: 'Error al registrar cliente', error: err.message });
  }
});


app.post('/api/auth/registro/empleado', authenticateJWT, verifyRole('admin', 'prestador'), async (req, res) => {
  try {
    const { nombre, email, telefono, password } = req.body;

    const existe = await Empleado.findOne({ email });
    if (existe) return res.status(409).json({ msg: 'El email ya está en uso' });

    const hash = await bcrypt.hash(password, 10);

    const nuevo = await Empleado.create({
      nombre,
      email,
      telefono,
      passwordHash: hash,
      prestadorId: req.user.id,
    });

    res.status(201).json({
      msg: 'Empleado registrado correctamente',
      empleado: {
        id: nuevo._id,
        nombre: nuevo.nombre,
        email: nuevo.email,
        telefono: nuevo.telefono,
        prestadorId: nuevo.prestadorId
      }
    });
  } catch (err) {
    res.status(500).json({ msg: 'Error al registrar empleado', error: err.message });
  }
});

app.get('/api/auth/empleados', authenticateJWT, verifyRole('admin', 'prestador'), async (req, res) => {
  try {
    const empleados = await Empleado.find({ prestadorId: req.user.id, eliminado: false }).select('-passwordHash');

    res.json({
      total: empleados.length,
      empleados: empleados.map(e => ({
        id: e._id,
        nombre: e.nombre,
        email: e.email,
        telefono: e.telefono,
      }))
    });
  } catch (err) {
    res.status(500).json({ msg: 'Error al obtener empleados', error: err.message });
  }
});

// ===============================
// 🔐 Login general (Admin, Prestador, Empleado)
// ===============================
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: 'Email y contraseña son obligatorios' });
  }

  try {
    let user = await Admin.findOne({ email });
    let tipo = 'admin';

    if (!user) {
      user = await Prestador.findOne({ email });
      tipo = 'prestador';
    }

    if (!user) {
      user = await Empleado.findOne({ email });
      tipo = 'empleado';
    }

    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ msg: 'Contraseña incorrecta' });

    const token = generarToken(user, tipo);

    res.json({
      msg: 'Login exitoso',
      token,
      usuario: {
        id: user._id,
        nombre: user.nombre || user.nombreComercial,
        email: user.email,
        tipo,
        nombreUrl: user.nombreUrl || ''
      }
    });
  } catch (err) {
    res.status(500).json({ msg: 'Error en el login', error: err.message });
  }
});

// ===============================
// ✅ Verificación de token
// ===============================
app.get('/api/auth/verificar', authenticateJWT, (req, res) => {
  res.json({
    valido: true,
    datos: req.user
  });
});

// ===============================
// 🚀 Iniciar microservicio
// ===============================
// const PORT = process.env.PORT_AUTH || 3001;
// app.listen(PORT, () => {
//   console.log(`[auth] Microservicio corriendo en http://localhost:${PORT}`);
// });

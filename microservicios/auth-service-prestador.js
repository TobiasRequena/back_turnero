require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

//Modelos
const Prestador = require('../models/Prestador');
const Empleado = require('../models/Empleado');

//Middleware
const verifyRole = require('../middleware/verifyRole');
const authenticateJWT = require('../middleware/authenticateJWT');

// Configuración global
const PORT = process.env.AUTH_PORT_PRESTADOR || 4000;
const MONGO_URI = process.env.MONGO_URI
const JWT_SECRET = process.env.JWT_SECRET || 'supersecreto';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';

// Iniciar app
const app = express();
app.use(express.json());

// Conexión a MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('[auth-service] MongoDB conectado'))
  .catch(err => console.error('Error MongoDB:', err));

// ============================
// ✅ REGISTRO Prestador
// ============================

app.post('/prestador/register', async (req, res) => {
  const { nombre, nombreComercial, telefono, email, password, rol, direccion } = req.body;

  if (!nombre || !nombreComercial || !telefono || !email || !password || !rol) {
    return res.status(400).json({ message: 'Faltan datos obligatorios' });
  }

  const existe = await Prestador.findOne({ $or: [{ nombre }, { email }] });
  if (existe) return res.status(409).json({ message: 'El nombre o email ya está registrado' });

  const hash = await bcrypt.hash(password, 10);

  // 👉 DEFINIMOS SUSCRIPCIÓN COMPLETA AL CREAR
  const vencimientoPorDefecto = new Date();
  vencimientoPorDefecto.setMonth(vencimientoPorDefecto.getMonth() + 1); // Ejemplo: 1 mes gratis

  const prestador = new Prestador({
    nombre,
    nombreComercial,
    telefono,
    email,
    password: hash,
    rol: rol || 'prestador',
    direccion,
    suscripcion: {
      estado: 'activo',
      plan: 'free',
      vencimiento: vencimientoPorDefecto
    }
  });

  const nuevoPrestador = await prestador.save();

  // Crear empleado por defecto (propietario)
  const empleadoPropietario = new Empleado({
    prestador: nuevoPrestador._id,
    nombre: nombreComercial,
    esPropietario: true,
    telefono
  });

  await empleadoPropietario.save();

  // Devolvemos prestador formateado para claridad
  res.status(201).json({
    message: 'Prestador registrado correctamente',
    prestador: {
      id: nuevoPrestador._id,
      nombre: nuevoPrestador.nombre,
      nombreComercial: nuevoPrestador.nombreComercial,
      telefono: nuevoPrestador.telefono,
      email: nuevoPrestador.email,
      direccion: nuevoPrestador.direccion,
      rol: nuevoPrestador.rol,
      suscripcion: nuevoPrestador.suscripcion
    }
  });
});

// ============================
// ✅ LOGIN Prestador
// ============================

app.post('/prestador/login', async (req, res) => {
  const { email, password } = req.body;

  const prestador = await Prestador.findOne({ email });
  if (!prestador) return res.status(404).json({ message: 'Prestador no encontrado' });

  const esValido = await bcrypt.compare(password, prestador.password);
  if (!esValido) return res.status(401).json({ message: 'Contraseña incorrecta' });

  const payload = {
    id: prestador._id,
    nombre: prestador.nombreComercial,
    email: prestador.email,
    telefono: prestador.telefono,
    rol: prestador.rol
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });

  res.json({
    message: 'Login exitoso',
    token,
    prestador: {
      id: prestador._id,
      nombre: prestador.nombreComercial,
      email: prestador.email,
      telefono: prestador.telefono,
      rol: prestador.rol,
      suscripcion: prestador.suscripcion
    }
  });
});

// Obtener todos los prestadores
app.get('/prestador/prestadores', authenticateJWT, verifyRole('prestador'), async (req, res) => {
  try {
    const prestadores = await Prestador.find().select('-password');

    const result = prestadores.map(p => ({
      id: p._id,
      nombre: p.nombre,
      nombreComercial: p.nombreComercial,
      telefono: p.telefono,
      email: p.email,
      direccion: p.direccion,
      rol: p.rol,
      suscripcion: p.suscripcion,
      creadoEn: p.creadoEn
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener prestadores', error: err.message });
  }
});


// Eliminar un prestador por ID *y* sus empleados asociados
app.delete('/prestador/prestadores/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const prestador = await Prestador.findById(id);
    if (!prestador) return res.status(404).json({ message: 'Prestador no encontrado' });

    // ⚠️ Primero eliminamos los empleados asociados
    await Empleado.deleteMany({ prestador: id });

    // ✅ Luego eliminamos el prestador
    await Prestador.findByIdAndDelete(id);

    res.json({ message: 'Prestador y empleados asociados eliminados correctamente' });
  } catch (err) {
    res.status(500).json({ message: 'Error al eliminar prestador', error: err.message });
  }
});

// Modificar estado de suscripción
app.patch('/prestador/prestadores/:id/suscripcion', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, plan, vencimiento } = req.body;

    const prestador = await Prestador.findById(id);
    if (!prestador) return res.status(404).json({ message: 'Prestador no encontrado' });

    if (estado) prestador.suscripcion.estado = estado;
    if (plan) prestador.suscripcion.plan = plan;
    if (vencimiento) prestador.suscripcion.vencimiento = vencimiento;

    await prestador.save();

    res.json({ message: 'Suscripción actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ message: 'Error al actualizar suscripción', error: err.message });
  }
});


// ============================
// ✅ Levantar servicio
// ============================

app.listen(PORT, () => {
  console.log(`[auth-service] Corriendo en http://localhost:${PORT}`);
});

const express = require('express');
const mongoose = require('mongoose');
const config = require('./config');

const app = express();
app.use(express.json());

// Conectar a MongoDB
mongoose.connect(config.db.mongoUri)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error MongoDB:', err));

// Ejemplo → ruta en Gateway (provisorio hasta separar en microservicios)
const authRoutes = require('./microservicios/auth-service');
app.use('/api/auth', authRoutes);

app.listen(config.app.port, () => {
  console.log(`Servidor escuchando en ${config.app.baseUrl}`);
});

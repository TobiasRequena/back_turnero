const express = require('express');
const mongoose = require('mongoose');
const config = require('./config');

const app = express();
app.use(express.json());

// Conectar a MongoDB
mongoose.connect(config.db.mongoUri)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error MongoDB:', err));

app.listen(config.app.port, () => {
  console.log(`Servidor escuchando en ${config.app.baseUrl}`);
});

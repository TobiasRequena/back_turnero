const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORTGATEWAY || 3000;
const PORT_AUTH = process.env.PORT_AUTH
const PORT_SERVICIOS = process.env.PORT_SERVICIOS || 3002;
const PORT_HORARIOS = process.env.PORT_HORARIOS || 3003;
const PORT_TURNOS = process.env.PORT_TURNOS || 3004;
const PORT_GRAL = process.env.PORT_GRAL || 3005;

app.use(cors());

app.use((req, res, next) => {
  console.log(`[Gateway] ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/api/auth', createProxyMiddleware({ target: `http://localhost:${PORT_AUTH}/api/auth`, changeOrigin: true }));
app.use('/api/servicios', createProxyMiddleware({ target: `http://localhost:${PORT_SERVICIOS}/api/servicios`, changeOrigin: true }));
app.use('/api/horarios', createProxyMiddleware({ target: `http://localhost:${PORT_HORARIOS}/api/horarios`, changeOrigin: true }));
app.use('/api/turnos', createProxyMiddleware({ target: `http://localhost:${PORT_TURNOS}/api/turnos`, changeOrigin: true }));
app.use('/api/general', createProxyMiddleware({ target: `http://localhost:${PORT_GRAL}/api/general`, changeOrigin: true }));

app.use(express.json());
app.get('/', (req, res) => {
  res.send('API Gateway funcionando ✅');
});

app.listen(PORT, () => console.log(`Gateway corriendo en http://localhost:${PORT}`));

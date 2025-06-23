const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'secreto123';

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Token no proporcionado' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(400).json({ message: 'Formato de token inválido. Debe ser: Bearer <token>' });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado' });
    }
    return res.status(403).json({ message: 'Token inválido' });
  }
}

module.exports = authenticateJWT;

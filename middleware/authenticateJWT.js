const jwt = require('jsonwebtoken');

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ msg: 'Token no provisto' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // 👉 Lo agregamos al request para usarlo en la ruta
    next();
  } catch (err) {
    return res.status(401).json({ msg: 'Token inválido', error: err.message });
  }
}

module.exports = authenticateJWT;


require('dotenv').config();

const config = {
  app: {
    port: process.env.PORT || 5000,
    baseUrl: process.env.BASE_URL || 'http://localhost:5000',
  },
  db: {
    mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tupeluya'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'secretoSuperSeguro',
    expiresIn: '7d'
  }
};

module.exports = config;
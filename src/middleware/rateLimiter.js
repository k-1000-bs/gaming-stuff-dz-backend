const rateLimit = require('express-rate-limit');

/** Limite générale sur toute l'API */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Trop de requêtes, réessayez dans quelques minutes.' },
});

/** Limite stricte sur les routes sensibles (login, register, reset password) */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  skipSuccessfulRequests: true,
});

module.exports = { apiLimiter, authLimiter };

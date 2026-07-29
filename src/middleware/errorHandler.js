const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const { env } = require('../config/env');

function handlePrismaError(err) {
  // Violation de contrainte unique (ex: email déjà utilisé)
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'champ';
    return new AppError(`Cette valeur pour "${field}" est déjà utilisée.`, 409);
  }
  // Enregistrement non trouvé
  if (err.code === 'P2025') {
    return new AppError('Ressource introuvable.', 404);
  }
  // Violation de clé étrangère
  if (err.code === 'P2003') {
    return new AppError('Référence invalide (ressource liée introuvable).', 400);
  }
  return null;
}

function handleJWTError() {
  return new AppError('Token invalide, veuillez vous reconnecter.', 401);
}

function handleJWTExpired() {
  return new AppError('Votre session a expiré, veuillez vous reconnecter.', 401);
}

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  let error = err;
  error.statusCode = error.statusCode || 500;

  if (err.code && err.code.startsWith('P')) error = handlePrismaError(err) || error;
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpired();
  if (err.name === 'ZodError') {
    error = new AppError(
      err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(' | '),
      422
    );
  }

  if (!error.isOperational) {
    logger.error('Erreur non opérationnelle', { message: err.message, stack: err.stack });
  } else if (error.statusCode >= 500) {
    logger.error(error.message, { stack: err.stack });
  }

  res.status(error.statusCode).json({
    status: error.status || 'error',
    message: error.isOperational ? error.message : 'Une erreur interne est survenue.',
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { verifyAccessToken } = require('../utils/tokens');
const prisma = require('../config/prisma');

/** Vérifie le JWT et attache req.user. Rejette si absent/invalide/expiré. */
const requireAuth = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.split(' ')[1] : null;

  if (!token) {
    return next(new AppError('Vous devez être connecté pour accéder à cette ressource.', 401));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    return next(new AppError('Session invalide ou expirée, veuillez vous reconnecter.', 401));
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    return next(new AppError("Ce compte n'existe plus ou a été désactivé.", 401));
  }

  req.user = user;
  next();
});

/** Authentification optionnelle : n'échoue jamais, attache req.user si un token valide est présent */
const optionalAuth = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.split(' ')[1] : null;
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user && user.isActive) req.user = user;
  } catch (_) {
    // token invalide -> on continue en tant qu'invité
  }
  next();
});

/** Restreint l'accès à une liste de rôles. Usage : restrictTo('ADMIN', 'MODERATOR') */
function restrictTo(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("Vous n'avez pas la permission d'effectuer cette action.", 403));
    }
    next();
  };
}

module.exports = { requireAuth, optionalAuth, restrictTo };

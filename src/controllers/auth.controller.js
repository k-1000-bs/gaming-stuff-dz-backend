const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const {
  signAccessToken,
  generateRefreshTokenValue,
  hashToken,
  generateOneTimeToken,
} = require('../utils/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { env } = require('../config/env');

const REFRESH_COOKIE = 'refreshToken';
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  };
}

function sanitizeUser(user) {
  const { password, emailVerifyToken, passwordResetToken, ...safe } = user;
  return safe;
}

async function issueTokens(user, req, res) {
  const accessToken = signAccessToken(user);
  const refreshRaw = generateRefreshTokenValue();

  await prisma.refreshToken.create({
    data: {
      token: hashToken(refreshRaw),
      userId: user.id,
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie(REFRESH_COOKIE, refreshRaw, refreshCookieOptions());
  return accessToken;
}

// ------------------------------------------------------------------
// POST /api/auth/register
// ------------------------------------------------------------------
exports.register = catchAsync(async (req, res) => {
  const { fullName, email, password, phone } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('Un compte existe déjà avec cet e-mail.', 409);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const { raw, hashed } = generateOneTimeToken();

  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      phone,
      password: hashedPassword,
      emailVerifyToken: hashed,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      cart: { create: {} },
    },
  });

  await sendVerificationEmail(user, raw);

  res.status(201).json({
    status: 'success',
    message: 'Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse e-mail.',
    data: { user: sanitizeUser(user) },
  });
});

// ------------------------------------------------------------------
// POST /api/auth/login
// ------------------------------------------------------------------
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return next(new AppError('E-mail ou mot de passe incorrect.', 401));
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil - new Date()) / 60000);
    return next(new AppError(`Compte temporairement bloqué. Réessayez dans ${minutes} min.`, 423));
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
      },
    });
    return next(new AppError('E-mail ou mot de passe incorrect.', 401));
  }

  if (!user.isActive) {
    return next(new AppError('Ce compte a été désactivé. Contactez le support.', 403));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  const accessToken = await issueTokens(user, req, res);

  res.status(200).json({
    status: 'success',
    data: { user: sanitizeUser(user), accessToken },
  });
});

// ------------------------------------------------------------------
// POST /api/auth/refresh — utilise le cookie httpOnly pour émettre un nouvel access token
// ------------------------------------------------------------------
exports.refresh = catchAsync(async (req, res, next) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) return next(new AppError('Session expirée, veuillez vous reconnecter.', 401));

  const hashed = hashToken(raw);
  const stored = await prisma.refreshToken.findUnique({ where: { token: hashed } });

  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    return next(new AppError('Session invalide, veuillez vous reconnecter.', 401));
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || !user.isActive) {
    return next(new AppError('Compte introuvable ou désactivé.', 401));
  }

  // Rotation du refresh token (empêche le rejeu en cas de vol)
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  const accessToken = await issueTokens(user, req, res);

  res.status(200).json({ status: 'success', data: { accessToken } });
});

// ------------------------------------------------------------------
// POST /api/auth/logout
// ------------------------------------------------------------------
exports.logout = catchAsync(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) {
    await prisma.refreshToken.updateMany({
      where: { token: hashToken(raw) },
      data: { revoked: true },
    });
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(200).json({ status: 'success', message: 'Déconnecté.' });
});

// ------------------------------------------------------------------
// GET /api/auth/verify-email?token=...
// ------------------------------------------------------------------
exports.verifyEmail = catchAsync(async (req, res, next) => {
  const hashed = hashToken(req.query.token || req.body.token);

  const user = await prisma.user.findFirst({
    where: { emailVerifyToken: hashed, emailVerifyExpires: { gt: new Date() } },
  });
  if (!user) {
    return next(new AppError('Lien de vérification invalide ou expiré.', 400));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
  });

  res.status(200).json({ status: 'success', message: 'Adresse e-mail vérifiée avec succès.' });
});

// ------------------------------------------------------------------
// POST /api/auth/forgot-password
// ------------------------------------------------------------------
exports.forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  // Réponse identique que le compte existe ou non (anti énumération d'e-mails)
  const genericResponse = {
    status: 'success',
    message: 'Si un compte existe avec cet e-mail, un lien de réinitialisation a été envoyé.',
  };

  if (!user) return res.status(200).json(genericResponse);

  const { raw, hashed } = generateOneTimeToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashed,
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  await sendPasswordResetEmail(user, raw);
  res.status(200).json(genericResponse);
});

// ------------------------------------------------------------------
// POST /api/auth/reset-password
// ------------------------------------------------------------------
exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token, password } = req.body;
  const hashed = hashToken(token);

  const user = await prisma.user.findFirst({
    where: { passwordResetToken: hashed, passwordResetExpires: { gt: new Date() } },
  });
  if (!user) {
    return next(new AppError('Lien de réinitialisation invalide ou expiré.', 400));
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  // Toutes les sessions existantes sont invalidées après un reset de mot de passe
  await prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revoked: true } });

  res.status(200).json({ status: 'success', message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' });
});

// ------------------------------------------------------------------
// GET /api/auth/me
// ------------------------------------------------------------------
exports.getMe = catchAsync(async (req, res) => {
  res.status(200).json({ status: 'success', data: { user: sanitizeUser(req.user) } });
});

// ------------------------------------------------------------------
// PATCH /api/auth/me
// ------------------------------------------------------------------
exports.updateMe = catchAsync(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: req.body,
  });
  res.status(200).json({ status: 'success', data: { user: sanitizeUser(user) } });
});

// ------------------------------------------------------------------
// PATCH /api/auth/change-password
// ------------------------------------------------------------------
exports.changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const valid = await bcrypt.compare(currentPassword, req.user.password);
  if (!valid) return next(new AppError('Mot de passe actuel incorrect.', 401));

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: req.user.id }, data: { password: hashedPassword } });
  await prisma.refreshToken.updateMany({ where: { userId: req.user.id }, data: { revoked: true } });

  res.status(200).json({ status: 'success', message: 'Mot de passe modifié. Reconnectez-vous.' });
});

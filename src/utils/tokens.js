const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { env } = require('../config/env');

/** Access token courte durée, envoyé au frontend en JSON (utilisé en Authorization: Bearer) */
function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

/** Refresh token longue durée, stocké en cookie httpOnly + hash en base */
function generateRefreshTokenValue() {
  return crypto.randomBytes(48).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Token à usage unique pour vérification email / reset mot de passe */
function generateOneTimeToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hashed = hashToken(raw);
  return { raw, hashed };
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshTokenValue,
  hashToken,
  generateOneTimeToken,
};

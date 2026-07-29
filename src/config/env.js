const requiredInProd = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'CLIENT_URL',
];

function getEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    return undefined;
  }
  return value;
}

const env = {
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  PORT: parseInt(getEnv('PORT', '4000'), 10),
  CLIENT_URL: getEnv('CLIENT_URL', 'http://localhost:5173'),

  DATABASE_URL: getEnv('DATABASE_URL'),

  JWT_ACCESS_SECRET: getEnv('JWT_ACCESS_SECRET'),
  JWT_ACCESS_EXPIRES: getEnv('JWT_ACCESS_EXPIRES', '15m'),
  JWT_REFRESH_SECRET: getEnv('JWT_REFRESH_SECRET'),
  JWT_REFRESH_EXPIRES_DAYS: parseInt(getEnv('JWT_REFRESH_EXPIRES_DAYS', '30'), 10),

  SMTP_HOST: getEnv('SMTP_HOST'),
  SMTP_PORT: parseInt(getEnv('SMTP_PORT', '587'), 10),
  SMTP_USER: getEnv('SMTP_USER'),
  SMTP_PASS: getEnv('SMTP_PASS'),
  EMAIL_FROM: getEnv('EMAIL_FROM', 'Gaming Stuff DZ <no-reply@gamingstuffdz.com>'),

  UPLOAD_DIR: getEnv('UPLOAD_DIR', 'public/uploads'),
  MAX_UPLOAD_MB: parseInt(getEnv('MAX_UPLOAD_MB', '5'), 10),

  COOKIE_SECRET: getEnv('COOKIE_SECRET', 'change-me-in-prod'),
};

function validateEnv() {
  if (env.NODE_ENV === 'production') {
    const missing = requiredInProd.filter((key) => !getEnv(key));
    if (missing.length) {
      throw new Error(
        `Variables d'environnement manquantes en production : ${missing.join(', ')}`
      );
    }
  }
}

module.exports = { env, validateEnv };

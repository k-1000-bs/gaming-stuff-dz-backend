const nodemailer = require('nodemailer');
const { env } = require('../config/env');
const logger = require('../config/logger');

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
});

async function sendMail({ to, subject, html }) {
  try {
    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html });
  } catch (err) {
    // Un échec d'envoi d'e-mail ne doit jamais faire planter la requête HTTP
    logger.error('Échec envoi email', { to, subject, error: err.message });
  }
}

function baseTemplate(title, bodyHtml) {
  return `
  <div style="font-family:Arial,sans-serif;background:#0a0a0a;padding:32px;color:#fff;">
    <div style="max-width:480px;margin:0 auto;background:#111;border:1px solid #232620;border-radius:8px;padding:32px;">
      <h1 style="color:#A6FF00;font-size:20px;letter-spacing:.05em;text-transform:uppercase;margin:0 0 20px;">Gaming Stuff DZ</h1>
      <h2 style="font-size:16px;margin:0 0 16px;">${title}</h2>
      <div style="font-size:14px;line-height:1.6;color:#ccc;">${bodyHtml}</div>
      <p style="margin-top:32px;font-size:12px;color:#666;">© ${new Date().getFullYear()} Gaming Stuff DZ — Algérie</p>
    </div>
  </div>`;
}

async function sendVerificationEmail(user, rawToken) {
  const link = `${env.CLIENT_URL}/verify-email?token=${rawToken}`;
  await sendMail({
    to: user.email,
    subject: 'Confirmez votre adresse e-mail',
    html: baseTemplate(
      `Bonjour ${user.fullName},`,
      `Merci de votre inscription. Confirmez votre e-mail en cliquant ci-dessous (lien valable 24h) :
       <p><a href="${link}" style="color:#A6FF00;">Confirmer mon e-mail</a></p>`
    ),
  });
}

async function sendPasswordResetEmail(user, rawToken) {
  const link = `${env.CLIENT_URL}/reset-password?token=${rawToken}`;
  await sendMail({
    to: user.email,
    subject: 'Réinitialisation de votre mot de passe',
    html: baseTemplate(
      `Bonjour ${user.fullName},`,
      `Vous avez demandé la réinitialisation de votre mot de passe (lien valable 1h) :
       <p><a href="${link}" style="color:#A6FF00;">Réinitialiser mon mot de passe</a></p>
       <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>`
    ),
  });
}

async function sendOrderConfirmationEmail(user, order) {
  await sendMail({
    to: user.email,
    subject: `Commande confirmée #${order.orderNumber}`,
    html: baseTemplate(
      `Merci pour votre commande, ${user.fullName} !`,
      `Votre commande <strong>#${order.orderNumber}</strong> d'un montant de <strong>${order.total} DZD</strong> a bien été enregistrée.
       Nous vous contacterons pour la livraison.`
    ),
  });
}

module.exports = {
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
};

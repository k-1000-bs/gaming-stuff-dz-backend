// Charge les variables d'environnement avant tout le reste
require('dotenv').config();

const { env, validateEnv } = require('./config/env');
const logger = require('./config/logger');

// Toute exception non interceptée ailleurs dans le code synchrone
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION — arrêt du serveur', { message: err.message, stack: err.stack });
  process.exit(1);
});

validateEnv();

const app = require('./app');

const server = app.listen(env.PORT, () => {
  logger.info(`Serveur démarré sur le port ${env.PORT} (${env.NODE_ENV})`);
});

// Toute rejection de promesse non gérée (ex: erreur DB async)
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION — arrêt du serveur', { message: err.message, stack: err.stack });
  server.close(() => process.exit(1));
});

// Arrêt propre (ex: redéploiement, conteneur stoppé)
process.on('SIGTERM', () => {
  logger.info('SIGTERM reçu, arrêt propre du serveur...');
  server.close(() => logger.info('Processus terminé.'));
});

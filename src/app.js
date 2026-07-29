const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const path = require('path');

const { env } = require('./config/env');
const logger = require('./config/logger');
const AppError = require('./utils/AppError');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const productRoutes = require('./routes/product.routes');
const cartRoutes = require('./routes/cart.routes');
const orderRoutes = require('./routes/order.routes');
const couponRoutes = require('./routes/coupon.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// Nécessaire derrière un reverse proxy (Nginx, Render, Railway...) pour un rate-limit fiable
app.set('trust proxy', 1);

// ---------------------------------------------------------------
// SÉCURITÉ
// ---------------------------------------------------------------
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true, // requis pour le cookie httpOnly de refresh token
  })
);
app.use(mongoSanitize()); // neutralise les opérateurs d'injection ($gt, $ne...) dans body/query/params
app.use(xss()); // échappe les payloads XSS dans les champs texte
app.use(hpp()); // empêche la pollution de paramètres HTTP (?price=10&price=0)
app.use('/api', apiLimiter);

// ---------------------------------------------------------------
// PARSERS
// ---------------------------------------------------------------
app.use(express.json({ limit: '10kb' })); // limite la taille du payload JSON (anti DoS)
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser(env.COOKIE_SECRET));
app.use(compression());

// ---------------------------------------------------------------
// LOGS HTTP
// ---------------------------------------------------------------
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// ---------------------------------------------------------------
// FICHIERS STATIQUES (images uploadées)
// ---------------------------------------------------------------
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR), { maxAge: '7d' }));

// ---------------------------------------------------------------
// HEALTHCHECK
// ---------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'API opérationnelle', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/admin', adminRoutes);

// ---------------------------------------------------------------
// 404
// ---------------------------------------------------------------
app.all('*', (req, res, next) => {
  next(new AppError(`Route introuvable : ${req.originalUrl}`, 404));
});

// ---------------------------------------------------------------
// GESTION D'ERREURS GLOBALE (doit rester en dernier)
// ---------------------------------------------------------------
app.use(errorHandler);

module.exports = app;

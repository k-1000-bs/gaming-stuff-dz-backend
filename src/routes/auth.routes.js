const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  updateMeSchema,
  changePasswordSchema,
} = require('../validators/auth.validators');

router.post('/register', authLimiter, validate(registerSchema), ctrl.register);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);

router.get('/verify-email', validate(verifyEmailSchema, 'query'), ctrl.verifyEmail);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), ctrl.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), ctrl.resetPassword);

router.get('/me', requireAuth, ctrl.getMe);
router.patch('/me', requireAuth, validate(updateMeSchema), ctrl.updateMe);
router.patch('/change-password', requireAuth, validate(changePasswordSchema), ctrl.changePassword);

module.exports = router;

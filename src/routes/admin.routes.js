const router = require('express').Router();
const adminCtrl = require('../controllers/admin.controller');
const orderCtrl = require('../controllers/order.controller');
const validate = require('../middleware/validate');
const { requireAuth, restrictTo } = require('../middleware/auth');
const { updateOrderStatusSchema } = require('../validators/order.validators');

router.use(requireAuth, restrictTo('ADMIN', 'MODERATOR'));

router.get('/dashboard', restrictTo('ADMIN'), adminCtrl.getDashboardStats);

router.get('/users', restrictTo('ADMIN'), adminCtrl.listUsers);
router.patch('/users/:id/role', restrictTo('ADMIN'), adminCtrl.updateUserRole);
router.patch('/users/:id/status', restrictTo('ADMIN'), adminCtrl.toggleUserStatus);

router.get('/orders', orderCtrl.listAllOrders);
router.patch('/orders/:id/status', validate(updateOrderStatusSchema), orderCtrl.updateOrderStatus);

module.exports = router;

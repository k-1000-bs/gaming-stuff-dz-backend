const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { addressSchema } = require('../validators/order.validators');

router.use(requireAuth);

router.get('/addresses', ctrl.listAddresses);
router.post('/addresses', validate(addressSchema), ctrl.addAddress);
router.delete('/addresses/:id', ctrl.deleteAddress);

router.get('/notifications', ctrl.listNotifications);
router.patch('/notifications/:id/read', ctrl.markNotificationRead);

module.exports = router;

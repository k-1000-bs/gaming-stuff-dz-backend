const router = require('express').Router();
const ctrl = require('../controllers/order.controller');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { createOrderSchema } = require('../validators/order.validators');

router.use(requireAuth);

router.post('/', validate(createOrderSchema), ctrl.createOrder);
router.get('/', ctrl.getMyOrders);
router.get('/:id', ctrl.getOrder);

module.exports = router;

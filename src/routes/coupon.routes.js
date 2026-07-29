const router = require('express').Router();
const ctrl = require('../controllers/coupon.controller');
const validate = require('../middleware/validate');
const { requireAuth, restrictTo } = require('../middleware/auth');
const { createCouponSchema } = require('../validators/order.validators');

router.get('/:code/check', ctrl.checkCoupon);

router.use(requireAuth, restrictTo('ADMIN'));
router.get('/', ctrl.listCoupons);
router.post('/', validate(createCouponSchema), ctrl.createCoupon);
router.patch('/:id', ctrl.updateCoupon);
router.delete('/:id', ctrl.deleteCoupon);

module.exports = router;

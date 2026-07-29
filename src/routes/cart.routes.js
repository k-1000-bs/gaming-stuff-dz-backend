const router = require('express').Router();
const ctrl = require('../controllers/cart.controller');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { addToCartSchema, updateCartItemSchema } = require('../validators/order.validators');

router.use(requireAuth); // le panier nécessite un compte (persistant, lié au user)

router.get('/', ctrl.getCart);
router.post('/items', validate(addToCartSchema), ctrl.addItem);
router.patch('/items/:itemId', validate(updateCartItemSchema), ctrl.updateItem);
router.delete('/items/:itemId', ctrl.removeItem);
router.delete('/', ctrl.clearCart);

module.exports = router;

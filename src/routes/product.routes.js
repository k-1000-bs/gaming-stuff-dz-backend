const router = require('express').Router();
const ctrl = require('../controllers/product.controller');
const catCtrl = require('../controllers/category.controller');
const validate = require('../middleware/validate');
const { requireAuth, optionalAuth, restrictTo } = require('../middleware/auth');
const { upload, processAndSaveImages } = require('../middleware/upload');
const {
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  createReviewSchema,
  listProductsQuerySchema,
} = require('../validators/product.validators');

// Catégories
router.get('/categories', catCtrl.listCategories);
router.post('/categories', requireAuth, restrictTo('ADMIN'), validate(createCategorySchema), catCtrl.createCategory);
router.patch('/categories/:id', requireAuth, restrictTo('ADMIN'), catCtrl.updateCategory);
router.delete('/categories/:id', requireAuth, restrictTo('ADMIN'), catCtrl.deleteCategory);

// Produits
router.get('/', validate(listProductsQuerySchema, 'query'), ctrl.listProducts);
router.get('/:slug', ctrl.getProduct);

router.post('/', requireAuth, restrictTo('ADMIN', 'MODERATOR'), validate(createProductSchema), ctrl.createProduct);
router.patch('/:id', requireAuth, restrictTo('ADMIN', 'MODERATOR'), validate(updateProductSchema), ctrl.updateProduct);
router.delete('/:id', requireAuth, restrictTo('ADMIN'), ctrl.deleteProduct);

router.post(
  '/:id/images',
  requireAuth,
  restrictTo('ADMIN', 'MODERATOR'),
  upload.array('images', 6),
  processAndSaveImages,
  ctrl.addProductImages
);

router.post('/:id/reviews', requireAuth, validate(createReviewSchema), ctrl.addReview);

module.exports = router;

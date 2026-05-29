const express = require('express');
const productController = require('../controllers/productController');
const { requireAdminApi } = require('../middleware/adminAuthMiddleware');

const router = express.Router();

router
  .route('/')
  .get(productController.getProducts)
  .post(requireAdminApi, productController.createProduct);

router.get('/categories', productController.getProductCategories);
router.get('/featured', productController.getFeaturedProducts);
router.get('/ready-made', productController.getReadyMadeProducts);
router.get('/boutique', productController.getBoutiqueProducts);
router.get('/affiliate', productController.getAffiliateProducts);

router.patch('/:id/stock', requireAdminApi, productController.updateProductStock);

router
  .route('/:id')
  .get(productController.getProduct)
  .put(requireAdminApi, productController.updateProduct)
  .patch(requireAdminApi, productController.updateProduct)
  .delete(requireAdminApi, productController.deleteProduct);

module.exports = router;

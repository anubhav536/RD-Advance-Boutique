const express = require('express');
const productController = require('../controllers/productController');

const router = express.Router();

router
  .route('/')
  .get(productController.getProducts)
  .post(productController.createProduct);

router.get('/categories', productController.getProductCategories);
router.get('/featured', productController.getFeaturedProducts);
router.get('/ready-made', productController.getReadyMadeProducts);
router.get('/boutique', productController.getBoutiqueProducts);
router.get('/affiliate', productController.getAffiliateProducts);

router.patch('/:id/stock', productController.updateProductStock);

router
  .route('/:id')
  .get(productController.getProduct)
  .put(productController.updateProduct)
  .patch(productController.updateProduct)
  .delete(productController.deleteProduct);

module.exports = router;

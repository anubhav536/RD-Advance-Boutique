const express = require('express');
const galleryController = require('../controllers/galleryController');
const { requireAdminApi } = require('../middleware/adminAuthMiddleware');

const router = express.Router();

router
  .route('/')
  .get(galleryController.getGalleryImages)
  .post(requireAdminApi, galleryController.createGalleryImage);

router.get('/categories', galleryController.getGalleryCategories);
router.get('/featured', galleryController.getFeaturedGalleryImages);

router
  .route('/:id')
  .get(galleryController.getGalleryImage)
  .put(requireAdminApi, galleryController.updateGalleryImage)
  .patch(requireAdminApi, galleryController.updateGalleryImage)
  .delete(requireAdminApi, galleryController.deleteGalleryImage);

module.exports = router;

const express = require('express');
const galleryController = require('../controllers/galleryController');

const router = express.Router();

router
  .route('/')
  .get(galleryController.getGalleryImages)
  .post(galleryController.createGalleryImage);

router.get('/categories', galleryController.getGalleryCategories);
router.get('/featured', galleryController.getFeaturedGalleryImages);

router
  .route('/:id')
  .get(galleryController.getGalleryImage)
  .put(galleryController.updateGalleryImage)
  .patch(galleryController.updateGalleryImage)
  .delete(galleryController.deleteGalleryImage);

module.exports = router;

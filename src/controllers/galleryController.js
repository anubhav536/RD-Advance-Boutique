const asyncHandler = require('../utils/asyncHandler');
const GalleryModel = require('../models/GalleryModel');

const sendGalleryList = (res, images) => {
  res.status(200).json({
    success: true,
    results: images.length,
    data: images,
  });
};

const getGalleryImages = asyncHandler(async (req, res) => {
  const images = await GalleryModel.findAll(req.query);
  sendGalleryList(res, images);
});

const createGalleryImage = asyncHandler(async (req, res) => {
  const image = await GalleryModel.create(req.body);

  res.status(201).json({
    success: true,
    data: image,
  });
});

const getGalleryImage = asyncHandler(async (req, res) => {
  const image = await GalleryModel.findById(req.params.id);

  res.status(200).json({
    success: true,
    data: image,
  });
});

const updateGalleryImage = asyncHandler(async (req, res) => {
  const image = await GalleryModel.update(req.params.id, req.body);

  res.status(200).json({
    success: true,
    data: image,
  });
});

const deleteGalleryImage = asyncHandler(async (req, res) => {
  const image = await GalleryModel.delete(req.params.id);

  res.status(200).json({
    success: true,
    data: image,
  });
});

const getGalleryCategories = asyncHandler(async (req, res) => {
  const categories = await GalleryModel.getCategories();

  res.status(200).json({
    success: true,
    results: categories.length,
    data: categories,
  });
});

const getFeaturedGalleryImages = asyncHandler(async (req, res) => {
  const images = await GalleryModel.findAll({ ...req.query, featured: true });
  sendGalleryList(res, images);
});

module.exports = {
  createGalleryImage,
  deleteGalleryImage,
  getFeaturedGalleryImages,
  getGalleryCategories,
  getGalleryImage,
  getGalleryImages,
  updateGalleryImage,
};

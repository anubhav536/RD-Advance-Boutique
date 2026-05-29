const asyncHandler = require('../utils/asyncHandler');
const ProductModel = require('../models/ProductModel');

const sendProductList = (res, products) => {
  res.status(200).json({
    success: true,
    results: products.length,
    data: products,
  });
};

const getProducts = asyncHandler(async (req, res) => {
  const products = await ProductModel.findAll(req.query);
  sendProductList(res, products);
});

const createProduct = asyncHandler(async (req, res) => {
  const product = await ProductModel.create(req.body);

  res.status(201).json({
    success: true,
    data: product,
  });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await ProductModel.findById(req.params.id);

  res.status(200).json({
    success: true,
    data: product,
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await ProductModel.update(req.params.id, req.body);

  res.status(200).json({
    success: true,
    data: product,
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await ProductModel.delete(req.params.id);

  res.status(200).json({
    success: true,
    data: product,
  });
});

const updateProductStock = asyncHandler(async (req, res) => {
  const product = await ProductModel.updateStock(req.params.id, req.body.stockQuantity ?? req.body.stock);

  res.status(200).json({
    success: true,
    data: product,
  });
});

const getProductCategories = asyncHandler(async (req, res) => {
  const categories = await ProductModel.getCategories();

  res.status(200).json({
    success: true,
    results: categories.length,
    data: categories,
  });
});

const getFeaturedProducts = asyncHandler(async (req, res) => {
  const products = await ProductModel.findAll({ ...req.query, featured: true });
  sendProductList(res, products);
});

const getReadyMadeProducts = asyncHandler(async (req, res) => {
  const products = await ProductModel.findAll({ ...req.query, type: 'ready-made' });
  sendProductList(res, products);
});

const getBoutiqueProducts = asyncHandler(async (req, res) => {
  const products = await ProductModel.findAll({ ...req.query, type: 'boutique' });
  sendProductList(res, products);
});

const getAffiliateProducts = asyncHandler(async (req, res) => {
  const products = await ProductModel.findAll({ ...req.query, type: 'affiliate' });
  sendProductList(res, products);
});

module.exports = {
  createProduct,
  deleteProduct,
  getAffiliateProducts,
  getBoutiqueProducts,
  getFeaturedProducts,
  getProduct,
  getProductCategories,
  getProducts,
  getReadyMadeProducts,
  updateProduct,
  updateProductStock,
};

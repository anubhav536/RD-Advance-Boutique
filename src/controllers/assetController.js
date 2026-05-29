const asyncHandler = require('../utils/asyncHandler');
const AssetModel = require('../models/AssetModel');

const getAssets = asyncHandler(async (req, res) => {
  const assets = await AssetModel.findAll();
  res.status(200).json({
    success: true,
    data: assets,
  });
});

const getAssetsByType = asyncHandler(async (req, res) => {
  const assets = await AssetModel.findByType(req.params.type);
  res.status(200).json({
    success: true,
    results: assets.length,
    data: assets,
  });
});

const uploadAsset = asyncHandler(async (req, res) => {
  const asset = await AssetModel.upload(req.params.type, req.file, req.body);
  res.status(201).json({
    success: true,
    data: asset,
  });
});

const replaceAsset = asyncHandler(async (req, res) => {
  const asset = await AssetModel.replace(req.params.type, req.params.id, req.file, req.body);
  res.status(200).json({
    success: true,
    data: asset,
  });
});

const deleteAsset = asyncHandler(async (req, res) => {
  const asset = await AssetModel.delete(req.params.type, req.params.id);
  res.status(200).json({
    success: true,
    data: asset,
  });
});

module.exports = {
  deleteAsset,
  getAssets,
  getAssetsByType,
  replaceAsset,
  uploadAsset,
};

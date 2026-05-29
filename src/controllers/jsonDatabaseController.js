const asyncHandler = require('../utils/asyncHandler');
const jsonDatabase = require('../utils/jsonDatabase');

const getCollections = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: Object.keys(jsonDatabase.COLLECTIONS),
  });
});

const getCollection = asyncHandler(async (req, res) => {
  const data = await jsonDatabase.readData(req.params.collection);

  res.status(200).json({
    success: true,
    data,
  });
});

const replaceCollection = asyncHandler(async (req, res) => {
  const data = await jsonDatabase.writeData(req.params.collection, req.body);

  res.status(200).json({
    success: true,
    data,
  });
});

const createItem = asyncHandler(async (req, res) => {
  const data = await jsonDatabase.addData(req.params.collection, req.body);

  res.status(201).json({
    success: true,
    data,
  });
});

const updateItem = asyncHandler(async (req, res) => {
  const data = await jsonDatabase.updateData(req.params.collection, req.params.id, req.body);

  res.status(200).json({
    success: true,
    data,
  });
});

const deleteItem = asyncHandler(async (req, res) => {
  const data = await jsonDatabase.deleteData(req.params.collection, req.params.id);

  res.status(200).json({
    success: true,
    data,
  });
});

module.exports = {
  createItem,
  deleteItem,
  getCollection,
  getCollections,
  replaceCollection,
  updateItem,
};

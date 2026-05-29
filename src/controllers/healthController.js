const HealthModel = require('../models/HealthModel');
const asyncHandler = require('../utils/asyncHandler');

const getHealth = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: HealthModel.currentStatus(),
  });
});

module.exports = {
  getHealth,
};

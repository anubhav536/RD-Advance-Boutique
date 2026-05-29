const asyncHandler = require('../utils/asyncHandler');
const OrderModel = require('../models/OrderModel');
const PaymentService = require('../services/payment/PaymentService');

const sendOrderList = (res, orders) => {
  res.status(200).json({
    success: true,
    results: orders.length,
    data: orders,
  });
};

const getOrders = asyncHandler(async (req, res) => {
  const orders = await OrderModel.findAll(req.query);
  sendOrderList(res, orders);
});

const createOrder = asyncHandler(async (req, res) => {
  const order = await OrderModel.create(req.body);

  res.status(201).json({
    success: true,
    data: order,
  });
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await OrderModel.findById(req.params.id);

  res.status(200).json({
    success: true,
    data: order,
  });
});

const trackOrder = asyncHandler(async (req, res) => {
  const order = await OrderModel.findByTrackingId(req.params.id);

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    success: true,
    data: order,
  });
});

const updateOrder = asyncHandler(async (req, res) => {
  const order = await OrderModel.update(req.params.id, req.body);

  res.status(200).json({
    success: true,
    data: order,
  });
});

const deleteOrder = asyncHandler(async (req, res) => {
  const order = await OrderModel.delete(req.params.id);

  res.status(200).json({
    success: true,
    data: order,
  });
});

const getPaymentMethods = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: PaymentService.listMethods(),
  });
});

const updatePayment = asyncHandler(async (req, res) => {
  const order = await PaymentService.submitOrderPayment(req.params.id, req.body);

  res.status(200).json({
    success: true,
    data: order,
  });
});

const approvePayment = asyncHandler(async (req, res) => {
  const order = await PaymentService.approveOrderPayment(req.params.id, {
    verifiedBy: req.body.verifiedBy || 'admin',
  });

  res.status(200).json({
    success: true,
    data: order,
  });
});

const rejectPayment = asyncHandler(async (req, res) => {
  const order = await PaymentService.rejectOrderPayment(req.params.id, {
    reason: req.body.reason || req.body.rejectionReason || '',
  });

  res.status(200).json({
    success: true,
    data: order,
  });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await OrderModel.updateStatus(req.params.id, req.body.status);

  res.status(200).json({
    success: true,
    data: order,
  });
});

const completeOrder = asyncHandler(async (req, res) => {
  const order = await OrderModel.updateStatus(req.params.id, 'completed');

  res.status(200).json({
    success: true,
    data: order,
  });
});

const cancelOrder = asyncHandler(async (req, res) => {
  const order = await OrderModel.updateStatus(req.params.id, 'cancelled');

  res.status(200).json({
    success: true,
    data: order,
  });
});

const getPendingOrders = asyncHandler(async (req, res) => {
  const orders = await OrderModel.findAll({ ...req.query, status: 'pending' });
  sendOrderList(res, orders);
});

const getCompletedOrders = asyncHandler(async (req, res) => {
  const orders = await OrderModel.findAll({ ...req.query, status: 'completed' });
  sendOrderList(res, orders);
});

const getCancelledOrders = asyncHandler(async (req, res) => {
  const orders = await OrderModel.findAll({ ...req.query, status: 'cancelled' });
  sendOrderList(res, orders);
});

const getCustomStitchingOrders = asyncHandler(async (req, res) => {
  const orders = await OrderModel.findAll({ ...req.query, orderType: 'custom-stitching' });
  sendOrderList(res, orders);
});

const getReadyMadeOrders = asyncHandler(async (req, res) => {
  const orders = await OrderModel.findAll({ ...req.query, orderType: 'ready-made' });
  sendOrderList(res, orders);
});

const getOrderSummary = asyncHandler(async (req, res) => {
  const summary = await OrderModel.getSummary();

  res.status(200).json({
    success: true,
    data: summary,
  });
});

module.exports = {
  cancelOrder,
  completeOrder,
  createOrder,
  deleteOrder,
  getCancelledOrders,
  getCompletedOrders,
  getCustomStitchingOrders,
  getOrder,
  getOrderSummary,
  trackOrder,
  getPaymentMethods,
  getOrders,
  getPendingOrders,
  getReadyMadeOrders,
  approvePayment,
  rejectPayment,
  updateOrder,
  updateOrderStatus,
  updatePayment,
};

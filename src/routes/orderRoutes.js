const express = require('express');
const orderController = require('../controllers/orderController');

const router = express.Router();

router
  .route('/')
  .get(orderController.getOrders)
  .post(orderController.createOrder);

router.get('/summary', orderController.getOrderSummary);
router.get('/pending', orderController.getPendingOrders);
router.get('/completed', orderController.getCompletedOrders);
router.get('/cancelled', orderController.getCancelledOrders);
router.get('/custom-stitching', orderController.getCustomStitchingOrders);
router.get('/ready-made', orderController.getReadyMadeOrders);

router.patch('/:id/status', orderController.updateOrderStatus);
router.patch('/:id/complete', orderController.completeOrder);
router.patch('/:id/cancel', orderController.cancelOrder);

router
  .route('/:id')
  .get(orderController.getOrder)
  .put(orderController.updateOrder)
  .patch(orderController.updateOrder)
  .delete(orderController.deleteOrder);

module.exports = router;

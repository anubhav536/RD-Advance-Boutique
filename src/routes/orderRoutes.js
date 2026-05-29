const express = require('express');
const orderController = require('../controllers/orderController');
const { requireAdminApi } = require('../middleware/adminAuthMiddleware');

const router = express.Router();

router
  .route('/')
  .get(requireAdminApi, orderController.getOrders)
  .post(orderController.createOrder);

router.get('/summary', requireAdminApi, orderController.getOrderSummary);
router.get('/pending', requireAdminApi, orderController.getPendingOrders);
router.get('/completed', requireAdminApi, orderController.getCompletedOrders);
router.get('/cancelled', requireAdminApi, orderController.getCancelledOrders);
router.get('/custom-stitching', requireAdminApi, orderController.getCustomStitchingOrders);
router.get('/ready-made', requireAdminApi, orderController.getReadyMadeOrders);

router.patch('/:id/status', requireAdminApi, orderController.updateOrderStatus);
router.patch('/:id/complete', requireAdminApi, orderController.completeOrder);
router.patch('/:id/cancel', requireAdminApi, orderController.cancelOrder);

router
  .route('/:id')
  .get(requireAdminApi, orderController.getOrder)
  .put(requireAdminApi, orderController.updateOrder)
  .patch(requireAdminApi, orderController.updateOrder)
  .delete(requireAdminApi, orderController.deleteOrder);

module.exports = router;

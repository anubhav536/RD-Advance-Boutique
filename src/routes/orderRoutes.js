const express = require('express');
const orderController = require('../controllers/orderController');
const { requireAdminApi } = require('../middleware/adminAuthMiddleware');

const router = express.Router();

router
  .route('/')
  .get(requireAdminApi, orderController.getOrders)
  .post(orderController.createOrder);

router.get('/summary', requireAdminApi, orderController.getOrderSummary);
router.get('/public/track/:id', orderController.trackOrder);
router.get('/track/:id', orderController.trackOrder);
router.get('/payment-methods', orderController.getPaymentMethods);
router.get('/pending', requireAdminApi, orderController.getPendingOrders);
router.get('/completed', requireAdminApi, orderController.getCompletedOrders);
router.get('/cancelled', requireAdminApi, orderController.getCancelledOrders);
router.get('/custom-stitching', requireAdminApi, orderController.getCustomStitchingOrders);
router.get('/ready-made', requireAdminApi, orderController.getReadyMadeOrders);
router.post('/ready-made', orderController.createReadyMadeOrder);

router.patch('/:id/payment', orderController.updatePayment);
router.patch('/:id/payment/approve', requireAdminApi, orderController.approvePayment);
router.patch('/:id/payment/reject', requireAdminApi, orderController.rejectPayment);
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

const express = require('express');
const contactController = require('../controllers/contactController');
const { requireAdminApi } = require('../middleware/adminAuthMiddleware');

const router = express.Router();

router.get('/', requireAdminApi, contactController.getContactOverview);
router.post('/', contactController.createSubmission);
router.get('/dashboard', requireAdminApi, contactController.getDashboard);
router.get('/constants', contactController.getConstants);

router
  .route('/submissions')
  .get(requireAdminApi, contactController.getSubmissions)
  .post(contactController.createSubmission);

router.patch('/submissions/:id/status', requireAdminApi, contactController.updateSubmissionStatus);
router.post('/submissions/:id/replies', requireAdminApi, contactController.addSubmissionReply);

router
  .route('/submissions/:id')
  .get(requireAdminApi, contactController.getSubmission)
  .put(requireAdminApi, contactController.updateSubmission)
  .patch(requireAdminApi, contactController.updateSubmission)
  .delete(requireAdminApi, contactController.deleteSubmission);

router
  .route('/tickets')
  .get(requireAdminApi, contactController.getTickets)
  .post(contactController.createTicket);

router.patch('/tickets/:id/status', requireAdminApi, contactController.updateTicketStatus);
router.post('/tickets/:id/replies', requireAdminApi, contactController.addTicketReply);

router
  .route('/tickets/:id')
  .get(requireAdminApi, contactController.getTicket)
  .put(requireAdminApi, contactController.updateTicket)
  .patch(requireAdminApi, contactController.updateTicket)
  .delete(requireAdminApi, contactController.deleteTicket);

module.exports = router;

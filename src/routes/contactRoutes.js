const express = require('express');
const contactController = require('../controllers/contactController');

const router = express.Router();

router.get('/', contactController.getContactOverview);
router.post('/', contactController.createSubmission);
router.get('/dashboard', contactController.getDashboard);
router.get('/constants', contactController.getConstants);

router
  .route('/submissions')
  .get(contactController.getSubmissions)
  .post(contactController.createSubmission);

router.patch('/submissions/:id/status', contactController.updateSubmissionStatus);
router.post('/submissions/:id/replies', contactController.addSubmissionReply);

router
  .route('/submissions/:id')
  .get(contactController.getSubmission)
  .put(contactController.updateSubmission)
  .patch(contactController.updateSubmission)
  .delete(contactController.deleteSubmission);

router
  .route('/tickets')
  .get(contactController.getTickets)
  .post(contactController.createTicket);

router.patch('/tickets/:id/status', contactController.updateTicketStatus);
router.post('/tickets/:id/replies', contactController.addTicketReply);

router
  .route('/tickets/:id')
  .get(contactController.getTicket)
  .put(contactController.updateTicket)
  .patch(contactController.updateTicket)
  .delete(contactController.deleteTicket);

module.exports = router;

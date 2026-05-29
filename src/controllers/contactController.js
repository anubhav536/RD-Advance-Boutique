const asyncHandler = require('../utils/asyncHandler');
const ContactModel = require('../models/ContactModel');

const sendList = (res, items) => {
  res.status(200).json({
    success: true,
    results: items.length,
    data: items,
  });
};

const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await ContactModel.getDashboard();
  res.status(200).json({ success: true, data: dashboard });
});

const getConstants = (req, res) => {
  res.status(200).json({ success: true, data: ContactModel.constants });
};

const getContactOverview = asyncHandler(async (req, res) => {
  const [submissions, tickets] = await Promise.all([
    ContactModel.listSubmissions(req.query),
    ContactModel.listTickets(req.query),
  ]);

  res.status(200).json({
    success: true,
    data: { submissions, tickets },
  });
});

const getSubmissions = asyncHandler(async (req, res) => {
  const submissions = await ContactModel.listSubmissions(req.query);
  sendList(res, submissions);
});

const createSubmission = asyncHandler(async (req, res) => {
  const submission = await ContactModel.createSubmission(req.body);
  res.status(201).json({ success: true, data: submission });
});

const getSubmission = asyncHandler(async (req, res) => {
  const submission = await ContactModel.getSubmission(req.params.id);
  res.status(200).json({ success: true, data: submission });
});

const updateSubmission = asyncHandler(async (req, res) => {
  const submission = await ContactModel.updateSubmission(req.params.id, req.body);
  res.status(200).json({ success: true, data: submission });
});

const deleteSubmission = asyncHandler(async (req, res) => {
  const submission = await ContactModel.deleteSubmission(req.params.id);
  res.status(200).json({ success: true, data: submission });
});

const updateSubmissionStatus = asyncHandler(async (req, res) => {
  const submission = await ContactModel.updateSubmissionStatus(req.params.id, req.body.status);
  res.status(200).json({ success: true, data: submission });
});

const addSubmissionReply = asyncHandler(async (req, res) => {
  const submission = await ContactModel.addSubmissionReply(req.params.id, req.body);
  res.status(201).json({ success: true, data: submission });
});

const getTickets = asyncHandler(async (req, res) => {
  const tickets = await ContactModel.listTickets(req.query);
  sendList(res, tickets);
});

const createTicket = asyncHandler(async (req, res) => {
  const ticket = await ContactModel.createTicket(req.body);
  res.status(201).json({ success: true, data: ticket });
});

const getTicket = asyncHandler(async (req, res) => {
  const ticket = await ContactModel.getTicket(req.params.id);
  res.status(200).json({ success: true, data: ticket });
});

const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await ContactModel.updateTicket(req.params.id, req.body);
  res.status(200).json({ success: true, data: ticket });
});

const deleteTicket = asyncHandler(async (req, res) => {
  const ticket = await ContactModel.deleteTicket(req.params.id);
  res.status(200).json({ success: true, data: ticket });
});

const updateTicketStatus = asyncHandler(async (req, res) => {
  const ticket = await ContactModel.updateTicketStatus(req.params.id, req.body.status);
  res.status(200).json({ success: true, data: ticket });
});

const addTicketReply = asyncHandler(async (req, res) => {
  const ticket = await ContactModel.addTicketReply(req.params.id, req.body);
  res.status(201).json({ success: true, data: ticket });
});

module.exports = {
  addSubmissionReply,
  addTicketReply,
  createSubmission,
  createTicket,
  deleteSubmission,
  deleteTicket,
  getConstants,
  getContactOverview,
  getDashboard,
  getSubmission,
  getSubmissions,
  getTicket,
  getTickets,
  updateSubmission,
  updateSubmissionStatus,
  updateTicket,
  updateTicketStatus,
};

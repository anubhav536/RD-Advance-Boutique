const BaseModel = require('./BaseModel');
const AppError = require('../utils/AppError');
const jsonDatabase = require('../utils/jsonDatabase');

const CONTACT_COLLECTION = 'contact';

const SUBMISSION_STATUSES = Object.freeze(['new', 'read', 'replied', 'closed']);
const TICKET_STATUSES = Object.freeze(['open', 'in-progress', 'waiting-customer', 'resolved', 'closed']);
const TICKET_PRIORITIES = Object.freeze(['low', 'medium', 'high', 'urgent']);
const SUPPORT_TYPES = Object.freeze(['general', 'order-issue', 'custom-stitching', 'course-enquiry', 'alteration', 'complaint', 'feedback']);

const DEFAULT_SUBMISSION_STATUS = 'new';
const DEFAULT_TICKET_STATUS = 'open';
const DEFAULT_TICKET_PRIORITY = 'medium';
const DEFAULT_SUPPORT_TYPE = 'general';

const normalizeSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const normalizeEnum = (value, allowedValues, defaultValue, fieldName) => {
  const normalizedValue = normalizeSlug(value || defaultValue);

  if (!allowedValues.includes(normalizedValue)) {
    throw new AppError(`${fieldName} must be one of: ${allowedValues.join(', ')}.`, 400, {
      allowedValues,
    });
  }

  return normalizedValue;
};

const toCleanString = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const stringValue = String(value).trim();
  return stringValue || undefined;
};

const cleanObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((result, [key, entry]) => {
    if (entry !== undefined && entry !== null && entry !== '') {
      result[key] = entry;
    }

    return result;
  }, {});
};

const normalizeCustomer = (payload = {}, currentCustomer = {}) => {
  const sourceCustomer = cleanObject(payload.customer);
  const customer = {
    ...currentCustomer,
    ...sourceCustomer,
  };

  ['name', 'email', 'phone'].forEach((field) => {
    const directValue = payload[field] ?? payload[`customer${field.charAt(0).toUpperCase()}${field.slice(1)}`];
    const stringValue = toCleanString(directValue);

    if (stringValue) {
      customer[field] = stringValue;
    }
  });

  return Object.entries(customer).reduce((result, [key, value]) => {
    const stringValue = toCleanString(value);
    if (stringValue) {
      result[key] = stringValue;
    }

    return result;
  }, {});
};

const normalizeReply = (payload = {}) => {
  const message = toCleanString(payload.message ?? payload.reply ?? payload.body);

  if (!message) {
    throw new AppError('Reply message is required.', 400);
  }

  return {
    id: normalizeSlug(payload.id) || `reply-${Date.now()}`,
    message,
    authorName: toCleanString(payload.authorName ?? payload.adminName ?? payload.name) || 'Admin',
    authorRole: toCleanString(payload.authorRole ?? payload.role) || 'admin',
    visibility: normalizeSlug(payload.visibility || 'public') === 'internal' ? 'internal' : 'public',
    createdAt: payload.createdAt || new Date().toISOString(),
  };
};

const getStore = async () => {
  const data = await jsonDatabase.readData(CONTACT_COLLECTION);

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new AppError('contact.json must contain an object.', 500);
  }

  return {
    submissions: Array.isArray(data.submissions) ? data.submissions : [],
    tickets: Array.isArray(data.tickets) ? data.tickets : [],
  };
};

const writeStore = (store) => jsonDatabase.writeData(CONTACT_COLLECTION, {
  submissions: store.submissions,
  tickets: store.tickets,
  updatedAt: new Date().toISOString(),
});

const createUniqueId = (source, collection, fallbackPrefix) => {
  const base = normalizeSlug(source) || fallbackPrefix;
  let candidate = base;
  let suffix = 2;

  while (collection.some((entry) => String(entry.id) === candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

const createTicketNumber = (tickets) => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let sequence = tickets.length + 1;
  let ticketNumber = '';

  do {
    ticketNumber = `RD-SUP-${datePart}-${String(sequence).padStart(4, '0')}`;
    sequence += 1;
  } while (tickets.some((ticket) => ticket.ticketNumber === ticketNumber));

  return ticketNumber;
};

const matchesText = (item, search) => {
  if (!search) {
    return true;
  }

  const normalizedSearch = String(search).trim().toLowerCase();
  const searchableText = [
    item.id,
    item.ticketNumber,
    item.status,
    item.subject,
    item.service,
    item.occasion,
    item.supportType,
    item.customer?.name,
    item.customer?.email,
    item.customer?.phone,
    item.message,
    ...(item.replies || []).map((reply) => reply.message),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchableText.includes(normalizedSearch);
};

const filterByDateRange = (item, filters) => {
  const createdAt = new Date(item.createdAt || 0);

  if (filters.createdFrom) {
    const createdFrom = new Date(filters.createdFrom);
    if (Number.isNaN(createdFrom.getTime())) {
      throw new AppError('createdFrom must be a valid date.', 400);
    }
    if (createdAt < createdFrom) {
      return false;
    }
  }

  if (filters.createdTo) {
    const createdTo = new Date(filters.createdTo);
    if (Number.isNaN(createdTo.getTime())) {
      throw new AppError('createdTo must be a valid date.', 400);
    }
    if (createdAt > createdTo) {
      return false;
    }
  }

  return true;
};

class ContactModel extends BaseModel {
  static get constants() {
    return {
      SUBMISSION_STATUSES,
      TICKET_STATUSES,
      TICKET_PRIORITIES,
      SUPPORT_TYPES,
    };
  }

  static async getDashboard() {
    const store = await getStore();

    return {
      submissions: {
        total: store.submissions.length,
        ...SUBMISSION_STATUSES.reduce((summary, status) => {
          summary[status] = store.submissions.filter((item) => item.status === status).length;
          return summary;
        }, {}),
      },
      tickets: {
        total: store.tickets.length,
        ...TICKET_STATUSES.reduce((summary, status) => {
          summary[status] = store.tickets.filter((item) => item.status === status).length;
          return summary;
        }, {}),
      },
    };
  }

  static async listSubmissions(filters = {}) {
    const store = await getStore();
    return store.submissions.filter((submission) => ContactModel.matchesSubmissionFilters(submission, filters));
  }

  static async createSubmission(payload) {
    const store = await getStore();
    const submission = ContactModel.normalizeSubmission(payload);
    submission.id = createUniqueId(payload.id || `${submission.customer.name}-${submission.customer.phone || submission.customer.email || Date.now()}`, store.submissions, 'contact-submission');
    submission.createdAt = payload.createdAt || new Date().toISOString();
    submission.updatedAt = new Date().toISOString();

    store.submissions.push(submission);
    await writeStore(store);
    return submission;
  }

  static async getSubmission(id) {
    const submissions = await ContactModel.listSubmissions();
    const submission = submissions.find((entry) => String(entry.id) === String(id));

    if (!submission) {
      throw new AppError(`No contact submission with id "${id}" exists.`, 404);
    }

    return submission;
  }

  static async updateSubmission(id, payload) {
    const store = await getStore();
    const itemIndex = store.submissions.findIndex((entry) => String(entry.id) === String(id));

    if (itemIndex === -1) {
      throw new AppError(`No contact submission with id "${id}" exists.`, 404);
    }

    const currentSubmission = store.submissions[itemIndex];
    const updates = ContactModel.normalizeSubmission(payload, { partial: true, currentSubmission });
    const updatedSubmission = {
      ...currentSubmission,
      ...updates,
      id: currentSubmission.id,
      createdAt: currentSubmission.createdAt,
      updatedAt: new Date().toISOString(),
    };

    store.submissions[itemIndex] = updatedSubmission;
    await writeStore(store);
    return updatedSubmission;
  }

  static async deleteSubmission(id) {
    const store = await getStore();
    const submission = store.submissions.find((entry) => String(entry.id) === String(id));

    if (!submission) {
      throw new AppError(`No contact submission with id "${id}" exists.`, 404);
    }

    store.submissions = store.submissions.filter((entry) => String(entry.id) !== String(id));
    await writeStore(store);
    return submission;
  }

  static async updateSubmissionStatus(id, status) {
    const normalizedStatus = normalizeEnum(status, SUBMISSION_STATUSES, DEFAULT_SUBMISSION_STATUS, 'Submission status');
    return ContactModel.updateSubmission(id, { status: normalizedStatus });
  }

  static async addSubmissionReply(id, payload) {
    const currentSubmission = await ContactModel.getSubmission(id);
    const replies = [...(currentSubmission.replies || []), normalizeReply(payload)];
    return ContactModel.updateSubmission(id, { replies, status: payload.status || 'replied' });
  }

  static async listTickets(filters = {}) {
    const store = await getStore();
    return store.tickets.filter((ticket) => ContactModel.matchesTicketFilters(ticket, filters));
  }

  static async createTicket(payload) {
    const store = await getStore();
    const ticket = ContactModel.normalizeTicket(payload);
    ticket.id = createUniqueId(payload.id || `${ticket.customer.name}-${ticket.subject || ticket.supportType}`, store.tickets, 'support-ticket');
    ticket.ticketNumber = payload.ticketNumber || createTicketNumber(store.tickets);
    ticket.createdAt = payload.createdAt || new Date().toISOString();
    ticket.updatedAt = new Date().toISOString();

    store.tickets.push(ticket);
    await writeStore(store);
    return ticket;
  }

  static async getTicket(id) {
    const tickets = await ContactModel.listTickets();
    const ticket = tickets.find((entry) => String(entry.id) === String(id) || String(entry.ticketNumber) === String(id));

    if (!ticket) {
      throw new AppError(`No support ticket with id "${id}" exists.`, 404);
    }

    return ticket;
  }

  static async updateTicket(id, payload) {
    const store = await getStore();
    const itemIndex = store.tickets.findIndex((entry) => String(entry.id) === String(id) || String(entry.ticketNumber) === String(id));

    if (itemIndex === -1) {
      throw new AppError(`No support ticket with id "${id}" exists.`, 404);
    }

    const currentTicket = store.tickets[itemIndex];
    const updates = ContactModel.normalizeTicket(payload, { partial: true, currentTicket });
    const updatedTicket = {
      ...currentTicket,
      ...updates,
      id: currentTicket.id,
      ticketNumber: currentTicket.ticketNumber,
      createdAt: currentTicket.createdAt,
      updatedAt: new Date().toISOString(),
    };

    store.tickets[itemIndex] = updatedTicket;
    await writeStore(store);
    return updatedTicket;
  }

  static async deleteTicket(id) {
    const store = await getStore();
    const ticket = store.tickets.find((entry) => String(entry.id) === String(id) || String(entry.ticketNumber) === String(id));

    if (!ticket) {
      throw new AppError(`No support ticket with id "${id}" exists.`, 404);
    }

    store.tickets = store.tickets.filter((entry) => String(entry.id) !== String(ticket.id));
    await writeStore(store);
    return ticket;
  }

  static async updateTicketStatus(id, status) {
    const normalizedStatus = normalizeEnum(status, TICKET_STATUSES, DEFAULT_TICKET_STATUS, 'Ticket status');
    const updates = { status: normalizedStatus };

    if (normalizedStatus === 'resolved') {
      updates.resolvedAt = new Date().toISOString();
      updates.closedAt = null;
    }

    if (normalizedStatus === 'closed') {
      updates.closedAt = new Date().toISOString();
    }

    if (['open', 'in-progress', 'waiting-customer'].includes(normalizedStatus)) {
      updates.resolvedAt = null;
      updates.closedAt = null;
    }

    return ContactModel.updateTicket(id, updates);
  }

  static async addTicketReply(id, payload) {
    const currentTicket = await ContactModel.getTicket(id);
    const replies = [...(currentTicket.replies || []), normalizeReply(payload)];
    const nextStatus = payload.status || (normalizeSlug(payload.visibility) === 'internal' ? currentTicket.status : 'waiting-customer');
    return ContactModel.updateTicket(id, { replies, status: nextStatus });
  }

  static normalizeSubmission(payload = {}, { partial = false, currentSubmission = {} } = {}) {
    const submission = {};
    const customer = normalizeCustomer(payload, currentSubmission.customer || {});

    if (!partial || Object.keys(customer).length > 0) {
      submission.customer = customer;
    }

    if (!partial && (!customer.name || !customer.phone)) {
      throw new AppError('Customer name and phone are required for contact submissions.', 400);
    }

    if (!partial || payload.status !== undefined) {
      submission.status = normalizeEnum(payload.status || currentSubmission.status, SUBMISSION_STATUSES, DEFAULT_SUBMISSION_STATUS, 'Submission status');
    }

    const service = toCleanString(payload.service ?? payload.occasion ?? payload.inquiryType ?? payload.type);
    if (service) {
      submission.service = service;
      submission.occasion = service;
    }

    ['subject', 'message', 'source'].forEach((field) => {
      const stringValue = toCleanString(payload[field]);
      if (stringValue) {
        submission[field] = stringValue;
      }
    });

    if (!partial && !submission.message) {
      throw new AppError('Message is required for contact submissions.', 400);
    }

    if (payload.metadata !== undefined) {
      submission.metadata = cleanObject(payload.metadata);
    }

    if (payload.replies !== undefined) {
      if (!Array.isArray(payload.replies)) {
        throw new AppError('replies must be an array.', 400);
      }
      submission.replies = payload.replies.map((reply) => normalizeReply(reply));
    } else if (!partial) {
      submission.replies = [];
    }

    return submission;
  }

  static normalizeTicket(payload = {}, { partial = false, currentTicket = {} } = {}) {
    const ticket = {};
    const customer = normalizeCustomer(payload, currentTicket.customer || {});

    if (!partial || Object.keys(customer).length > 0) {
      ticket.customer = customer;
    }

    if (!partial && (!customer.name || !customer.phone)) {
      throw new AppError('Customer name and phone are required for support tickets.', 400);
    }

    if (!partial || payload.status !== undefined) {
      ticket.status = normalizeEnum(payload.status || currentTicket.status, TICKET_STATUSES, DEFAULT_TICKET_STATUS, 'Ticket status');
    }

    if (!partial || payload.priority !== undefined) {
      ticket.priority = normalizeEnum(payload.priority || currentTicket.priority, TICKET_PRIORITIES, DEFAULT_TICKET_PRIORITY, 'Ticket priority');
    }

    if (!partial || payload.supportType !== undefined || payload.type !== undefined || payload.category !== undefined) {
      ticket.supportType = normalizeEnum(payload.supportType || payload.type || payload.category || currentTicket.supportType, SUPPORT_TYPES, DEFAULT_SUPPORT_TYPE, 'Support type');
    }

    ['subject', 'message', 'orderId', 'orderNumber', 'source'].forEach((field) => {
      const stringValue = toCleanString(payload[field]);
      if (stringValue) {
        ticket[field] = stringValue;
      }
    });

    if (!partial && !ticket.subject) {
      ticket.subject = ticket.supportType.replace(/-/g, ' ');
    }

    if (!partial && !ticket.message) {
      throw new AppError('Message is required for support tickets.', 400);
    }

    if (payload.metadata !== undefined) {
      ticket.metadata = cleanObject(payload.metadata);
    }

    if (payload.replies !== undefined) {
      if (!Array.isArray(payload.replies)) {
        throw new AppError('replies must be an array.', 400);
      }
      ticket.replies = payload.replies.map((reply) => normalizeReply(reply));
    } else if (!partial) {
      ticket.replies = [];
    }

    return ticket;
  }

  static matchesSubmissionFilters(submission, filters = {}) {
    if (filters.status && submission.status !== normalizeEnum(filters.status, SUBMISSION_STATUSES, DEFAULT_SUBMISSION_STATUS, 'Submission status')) {
      return false;
    }

    if (filters.phone && String(submission.customer?.phone || '') !== String(filters.phone)) {
      return false;
    }

    if (filters.email && String(submission.customer?.email || '').toLowerCase() !== String(filters.email).toLowerCase()) {
      return false;
    }

    if (!matchesText(submission, filters.search)) {
      return false;
    }

    return filterByDateRange(submission, filters);
  }

  static matchesTicketFilters(ticket, filters = {}) {
    if (filters.status && ticket.status !== normalizeEnum(filters.status, TICKET_STATUSES, DEFAULT_TICKET_STATUS, 'Ticket status')) {
      return false;
    }

    if (filters.priority && ticket.priority !== normalizeEnum(filters.priority, TICKET_PRIORITIES, DEFAULT_TICKET_PRIORITY, 'Ticket priority')) {
      return false;
    }

    if (filters.supportType && ticket.supportType !== normalizeEnum(filters.supportType, SUPPORT_TYPES, DEFAULT_SUPPORT_TYPE, 'Support type')) {
      return false;
    }

    if (filters.phone && String(ticket.customer?.phone || '') !== String(filters.phone)) {
      return false;
    }

    if (filters.email && String(ticket.customer?.email || '').toLowerCase() !== String(filters.email).toLowerCase()) {
      return false;
    }

    if (!matchesText(ticket, filters.search)) {
      return false;
    }

    return filterByDateRange(ticket, filters);
  }
}

module.exports = ContactModel;

const BaseModel = require('./BaseModel');
const AppError = require('../utils/AppError');
const jsonDatabase = require('../utils/jsonDatabase');

const ORDER_COLLECTION = 'orders';

const ORDER_STATUSES = Object.freeze(['pending', 'in-progress', 'completed', 'cancelled']);
const ORDER_TYPES = Object.freeze(['custom-stitching', 'ready-made']);

const DEFAULT_STATUS = 'pending';
const DEFAULT_CURRENCY = 'INR';

const normalizeSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const normalizeStatus = (status = DEFAULT_STATUS) => {
  const normalizedStatus = normalizeSlug(status || DEFAULT_STATUS);

  if (!ORDER_STATUSES.includes(normalizedStatus)) {
    throw new AppError('Order status must be pending, in-progress, completed, or cancelled.', 400, {
      allowedStatuses: ORDER_STATUSES,
    });
  }

  return normalizedStatus;
};

const normalizeOrderType = (orderType) => {
  const normalizedOrderType = normalizeSlug(orderType || '');

  if (!ORDER_TYPES.includes(normalizedOrderType)) {
    throw new AppError('Order type must be custom-stitching or ready-made.', 400, {
      allowedTypes: ORDER_TYPES,
    });
  }

  return normalizedOrderType;
};

const toNumber = (value, fieldName, { required = false, integer = false, minimum = 0 } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new AppError(`${fieldName} is required.`, 400);
    }

    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new AppError(`${fieldName} must be a valid number.`, 400);
  }

  if (integer && !Number.isInteger(parsed)) {
    throw new AppError(`${fieldName} must be a whole number.`, 400);
  }

  if (parsed < minimum) {
    throw new AppError(`${fieldName} must be greater than or equal to ${minimum}.`, 400);
  }

  return parsed;
};

const toStringArray = (value) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const values = Array.isArray(value) ? value : String(value).split(',');

  return values
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
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

  const directFields = ['name', 'email', 'phone', 'address', 'city', 'state', 'postalCode'];

  directFields.forEach((field) => {
    const payloadKey = `customer${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    if (payload[payloadKey] !== undefined && payload[payloadKey] !== null && payload[payloadKey] !== '') {
      customer[field] = payload[payloadKey];
    }
  });

  if (!customer.name && payload.name) {
    customer.name = payload.name;
  }

  if (!customer.phone && payload.phone) {
    customer.phone = payload.phone;
  }

  if (!customer.email && payload.email) {
    customer.email = payload.email;
  }

  return Object.entries(customer).reduce((result, [key, entry]) => {
    if (entry !== undefined && entry !== null && entry !== '') {
      result[key] = String(entry).trim();
    }

    return result;
  }, {});
};


const normalizeMeasurementValue = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const stringValue = String(value).trim();

  if (!stringValue) {
    return undefined;
  }

  const numericValue = Number(stringValue);
  if (Number.isFinite(numericValue) && numericValue < 0) {
    throw new AppError(`${fieldName} must be greater than or equal to 0.`, 400);
  }

  return stringValue;
};

const normalizeMeasurements = (payloadMeasurements = {}, currentMeasurements = {}) => {
  const directMeasurementFields = [
    'bust',
    'waist',
    'hip',
    'shoulder',
    'sleeve',
    'length',
    'neck',
    'armhole',
  ];
  const measurements = {
    ...currentMeasurements,
    ...cleanObject(payloadMeasurements),
  };

  directMeasurementFields.forEach((field) => {
    const measurementValue = normalizeMeasurementValue(payloadMeasurements[field] ?? measurements[field], `measurements.${field}`);
    if (measurementValue !== undefined) {
      measurements[field] = measurementValue;
    }
  });

  const notes = payloadMeasurements.notes ?? payloadMeasurements.measurementNotes ?? measurements.notes;
  if (notes !== undefined && notes !== null && notes !== '') {
    measurements.notes = String(notes).trim();
  }

  return cleanObject(measurements);
};

const normalizeFabricSelection = (payload = {}, currentFabricSelection = {}) => {
  const incomingFabric = payload.fabricSelection || {};
  const fabricSelection = {
    ...currentFabricSelection,
    ...cleanObject(incomingFabric),
  };

  if (payload.fabric !== undefined) {
    fabricSelection.type = String(payload.fabric).trim();
  }

  if (payload.fabricType !== undefined) {
    fabricSelection.type = String(payload.fabricType).trim();
  }

  if (payload.fabricDetails !== undefined) {
    fabricSelection.details = String(payload.fabricDetails).trim();
  }

  return cleanObject(fabricSelection);
};

const normalizeDesignReference = (payload = {}, currentDesignReference = {}) => {
  const incomingReference = payload.designReference || payload.referenceDesign || {};
  const designReference = {
    ...currentDesignReference,
    ...cleanObject(incomingReference),
  };

  ['fileName', 'fileType', 'dataUrl', 'url'].forEach((field) => {
    const payloadValue = payload[`reference${field.charAt(0).toUpperCase()}${field.slice(1)}`];
    if (payloadValue !== undefined && payloadValue !== null && payloadValue !== '') {
      designReference[field] = String(payloadValue).trim();
    }
  });

  return cleanObject(designReference);
};

const normalizeAppointmentDate = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError('appointmentDate must be a valid date.', 400);
  }

  return String(value).trim();
};

const normalizeItems = (items) => {
  if (items === undefined || items === null || items === '') {
    return [];
  }

  if (!Array.isArray(items)) {
    throw new AppError('items must be an array.', 400);
  }

  return items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AppError(`items[${index}] must be an object.`, 400);
    }

    const quantity = toNumber(item.quantity ?? 1, `items[${index}].quantity`, {
      integer: true,
      minimum: 1,
    });
    const price = toNumber(item.price ?? item.unitPrice, `items[${index}].price`, {
      minimum: 0,
    });

    return {
      ...item,
      quantity,
      ...(price !== undefined ? { price } : {}),
    };
  });
};

const calculateItemsTotal = (items) => items.reduce((total, item) => {
  const quantity = Number(item.quantity || 0);
  const price = Number(item.price || 0);
  return total + (quantity * price);
}, 0);

const matchesText = (order, search) => {
  if (!search) {
    return true;
  }

  const normalizedSearch = String(search).trim().toLowerCase();
  const searchableText = [
    order.id,
    order.orderNumber,
    order.status,
    order.orderType,
    order.customer?.name,
    order.customer?.email,
    order.customer?.phone,
    order.productId,
    order.productName,
    order.notes,
    order.appointmentDate,
    order.fabricSelection?.type,
    order.fabricSelection?.details,
    order.stitchingDetails?.outfit,
    order.stitchingDetails?.occasion,
    order.stitchingDetails?.designInstructions,
    ...(order.items || []).flatMap((item) => [item.productId, item.name, item.title, item.sku]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchableText.includes(normalizedSearch);
};

const parseDateFilter = (value, fieldName) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`${fieldName} must be a valid date.`, 400);
  }

  return parsed;
};

class OrderModel extends BaseModel {
  static get constants() {
    return {
      ORDER_STATUSES,
      ORDER_TYPES,
    };
  }

  static async findAll(filters = {}) {
    const orders = await jsonDatabase.readData(ORDER_COLLECTION);

    if (!Array.isArray(orders)) {
      throw new AppError('orders.json must contain an array.', 500);
    }

    return orders.filter((order) => OrderModel.matchesFilters(order, filters));
  }

  static async findById(id) {
    const orders = await OrderModel.findAll();
    const order = orders.find((entry) => String(entry.id) === String(id));

    if (!order) {
      throw new AppError(`No order with id "${id}" exists.`, 404);
    }

    return order;
  }

  static async create(payload) {
    const orders = await OrderModel.findAll();
    const order = OrderModel.normalizePayload(payload, { partial: false });
    order.id = OrderModel.createUniqueId({ ...order, id: payload.id }, orders);
    order.orderNumber = payload.orderNumber || OrderModel.createUniqueOrderNumber(orders);
    order.createdAt = payload.createdAt || new Date().toISOString();
    order.updatedAt = new Date().toISOString();

    if (orders.some((entry) => String(entry.orderNumber) === String(order.orderNumber))) {
      throw new AppError(`An order with orderNumber "${order.orderNumber}" already exists.`, 409);
    }

    await jsonDatabase.writeData(ORDER_COLLECTION, [...orders, order]);
    return order;
  }

  static async update(id, payload) {
    const orders = await OrderModel.findAll();
    const itemIndex = orders.findIndex((entry) => String(entry.id) === String(id));

    if (itemIndex === -1) {
      throw new AppError(`No order with id "${id}" exists.`, 404);
    }

    const currentOrder = orders[itemIndex];
    const updates = OrderModel.normalizePayload(payload, { partial: true, currentOrder });
    const updatedOrder = {
      ...currentOrder,
      ...updates,
      id: currentOrder.id,
      orderNumber: currentOrder.orderNumber,
      createdAt: currentOrder.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const updatedOrders = [...orders];
    updatedOrders[itemIndex] = updatedOrder;

    await jsonDatabase.writeData(ORDER_COLLECTION, updatedOrders);
    return updatedOrder;
  }

  static async delete(id) {
    const orders = await OrderModel.findAll();
    const order = orders.find((entry) => String(entry.id) === String(id));

    if (!order) {
      throw new AppError(`No order with id "${id}" exists.`, 404);
    }

    await jsonDatabase.writeData(
      ORDER_COLLECTION,
      orders.filter((entry) => String(entry.id) !== String(id)),
    );

    return order;
  }

  static async updateStatus(id, status) {
    if (status === undefined || status === null || status === '') {
      throw new AppError('status is required.', 400);
    }

    const normalizedStatus = normalizeStatus(status);
    const statusUpdates = { status: normalizedStatus };

    if (normalizedStatus === 'completed') {
      statusUpdates.completedAt = new Date().toISOString();
      statusUpdates.cancelledAt = null;
    }

    if (normalizedStatus === 'in-progress') {
      statusUpdates.startedAt = new Date().toISOString();
      statusUpdates.completedAt = null;
      statusUpdates.cancelledAt = null;
    }

    if (normalizedStatus === 'cancelled') {
      statusUpdates.cancelledAt = new Date().toISOString();
      statusUpdates.completedAt = null;
    }

    if (normalizedStatus === 'pending') {
      statusUpdates.startedAt = null;
      statusUpdates.completedAt = null;
      statusUpdates.cancelledAt = null;
    }

    return OrderModel.update(id, statusUpdates);
  }

  static async getSummary() {
    const orders = await OrderModel.findAll();

    return {
      total: orders.length,
      statuses: ORDER_STATUSES.reduce((summary, status) => {
        summary[status] = orders.filter((order) => order.status === status).length;
        return summary;
      }, {}),
      orderTypes: ORDER_TYPES.reduce((summary, orderType) => {
        summary[orderType] = orders.filter((order) => order.orderType === orderType).length;
        return summary;
      }, {}),
    };
  }

  static normalizePayload(payload = {}, { partial = false, currentOrder = {} } = {}) {
    const order = {};

    if (!partial || payload.status !== undefined) {
      order.status = normalizeStatus(payload.status || currentOrder.status || DEFAULT_STATUS);
    }

    const incomingOrderType = payload.orderType ?? payload.type;
    if (!partial || incomingOrderType !== undefined) {
      order.orderType = normalizeOrderType(incomingOrderType || currentOrder.orderType);
    }

    const customer = normalizeCustomer(payload, currentOrder.customer || {});
    if (!partial || Object.keys(customer).length > 0) {
      order.customer = customer;
    }

    if (!partial && (!order.customer.name || !order.customer.phone)) {
      throw new AppError('Customer name and phone are required.', 400);
    }

    if (payload.items !== undefined) {
      order.items = normalizeItems(payload.items);
    } else if (!partial) {
      order.items = [];
    }

    if (payload.productId !== undefined) {
      order.productId = String(payload.productId).trim();
    }

    if (payload.productName !== undefined) {
      order.productName = String(payload.productName).trim();
    }

    const incomingMeasurements = payload.measurements || {};
    ['bust', 'waist', 'hip', 'shoulder', 'sleeve', 'length', 'neck', 'armhole'].forEach((field) => {
      if (payload[field] !== undefined) {
        incomingMeasurements[field] = payload[field];
      }
    });
    if (payload.measurementNotes !== undefined || payload.measurement_notes !== undefined) {
      incomingMeasurements.notes = payload.measurementNotes ?? payload.measurement_notes;
    }
    if (payload.measurements !== undefined || Object.keys(incomingMeasurements).length > 0) {
      order.measurements = normalizeMeasurements(incomingMeasurements, currentOrder.measurements || {});
    }

    const stitchingDetails = {
      ...(currentOrder.stitchingDetails || {}),
      ...cleanObject(payload.stitchingDetails),
    };
    const stitchingFieldMap = {
      outfit: payload.outfit,
      occasion: payload.occasion,
      designInstructions: payload.designInstructions ?? payload.design_instructions,
      consultationType: payload.consultationType ?? payload.consultation_type,
      timeline: payload.timeline,
    };
    Object.entries(stitchingFieldMap).forEach(([field, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        stitchingDetails[field] = String(value).trim();
      }
    });
    if (payload.stitchingDetails !== undefined || Object.values(stitchingFieldMap).some((value) => value !== undefined)) {
      order.stitchingDetails = cleanObject(stitchingDetails);
    }

    const fabricSelection = normalizeFabricSelection(payload, currentOrder.fabricSelection || {});
    if (!partial || payload.fabricSelection !== undefined || payload.fabric !== undefined || payload.fabricType !== undefined || payload.fabricDetails !== undefined) {
      order.fabricSelection = fabricSelection;
    }

    const designReference = normalizeDesignReference(payload, currentOrder.designReference || {});
    if (payload.designReference !== undefined || payload.referenceDesign !== undefined || Object.keys(designReference).length > 0) {
      order.designReference = designReference;
    }

    const appointmentDate = normalizeAppointmentDate(payload.appointmentDate ?? payload.appointment_date);
    if (appointmentDate !== undefined) {
      order.appointmentDate = appointmentDate;
    }

    if (payload.appointmentTime !== undefined || payload.appointment_time !== undefined) {
      order.appointmentTime = String(payload.appointmentTime ?? payload.appointment_time).trim();
    }

    if (payload.size !== undefined) {
      order.size = String(payload.size).trim();
    }

    if (payload.color !== undefined) {
      order.color = String(payload.color).trim();
    }

    if (payload.notes !== undefined) {
      order.notes = String(payload.notes).trim();
    }

    if (payload.tags !== undefined) {
      order.tags = toStringArray(payload.tags);
    }

    if (payload.dueDate !== undefined) {
      const parsedDueDate = payload.dueDate ? new Date(payload.dueDate) : null;

      if (parsedDueDate && Number.isNaN(parsedDueDate.getTime())) {
        throw new AppError('dueDate must be a valid date.', 400);
      }

      order.dueDate = parsedDueDate ? parsedDueDate.toISOString() : null;
    }

    if (payload.completedAt !== undefined) {
      order.completedAt = payload.completedAt;
    }

    if (payload.cancelledAt !== undefined) {
      order.cancelledAt = payload.cancelledAt;
    }

    const itemsForTotal = order.items || currentOrder.items || [];
    const calculatedTotal = calculateItemsTotal(itemsForTotal);
    const totalAmount = toNumber(payload.totalAmount ?? payload.total, 'totalAmount', {
      minimum: 0,
    });

    if (totalAmount !== undefined) {
      order.totalAmount = totalAmount;
    } else if (!partial || payload.items !== undefined) {
      order.totalAmount = calculatedTotal;
    }

    if (payload.currency !== undefined || !partial) {
      order.currency = String(payload.currency || currentOrder.currency || DEFAULT_CURRENCY).trim().toUpperCase();
    }

    return Object.entries(order).reduce((result, [key, value]) => {
      if (value !== undefined) {
        result[key] = value;
      }

      return result;
    }, {});
  }

  static matchesFilters(order, filters = {}) {
    if (filters.status && order.status !== normalizeStatus(filters.status)) {
      return false;
    }

    const filterType = filters.orderType ?? filters.type;
    if (filterType && order.orderType !== normalizeOrderType(filterType)) {
      return false;
    }

    if (filters.customerPhone && String(order.customer?.phone || '') !== String(filters.customerPhone)) {
      return false;
    }

    if (filters.customerEmail && String(order.customer?.email || '').toLowerCase() !== String(filters.customerEmail).toLowerCase()) {
      return false;
    }

    if (filters.productId) {
      const hasProduct = String(order.productId || '') === String(filters.productId)
        || (order.items || []).some((item) => String(item.productId || '') === String(filters.productId));

      if (!hasProduct) {
        return false;
      }
    }

    if (!matchesText(order, filters.search)) {
      return false;
    }

    const createdFrom = parseDateFilter(filters.createdFrom, 'createdFrom');
    if (createdFrom && new Date(order.createdAt) < createdFrom) {
      return false;
    }

    const createdTo = parseDateFilter(filters.createdTo, 'createdTo');
    if (createdTo && new Date(order.createdAt) > createdTo) {
      return false;
    }

    const appointmentDate = parseDateFilter(filters.appointmentDate, 'appointmentDate');
    if (appointmentDate && order.appointmentDate !== filters.appointmentDate) {
      return false;
    }

    return true;
  }

  static createUniqueId(order, existingOrders) {
    if (order.id && !existingOrders.some((entry) => String(entry.id) === String(order.id))) {
      return String(order.id);
    }

    const base = normalizeSlug(order.orderNumber || order.customer?.name || order.customer?.phone || 'order') || 'order';
    let candidate = base;
    let suffix = 2;

    while (existingOrders.some((entry) => String(entry.id) === candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  static createUniqueOrderNumber(existingOrders) {
    const date = new Date();
    const datePart = date.toISOString().slice(0, 10).replace(/-/g, '');
    let sequence = existingOrders.length + 1;
    let orderNumber = '';

    do {
      const sequencePart = String(sequence).padStart(4, '0');
      orderNumber = `RD-${datePart}-${sequencePart}`;
      sequence += 1;
    } while (existingOrders.some((entry) => String(entry.orderNumber) === orderNumber));

    return orderNumber;
  }
}

module.exports = OrderModel;

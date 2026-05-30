const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const AppError = require('./AppError');

const DATA_DIR = path.resolve(__dirname, '../../data');

const COLLECTIONS = Object.freeze({
  products: { file: 'products.json', type: 'array' },
  orders: { file: 'orders.json', type: 'array' },
  gallery: { file: 'gallery.json', type: 'array' },
  categories: { file: 'categories.json', type: 'array' },
  students: { file: 'students.json', type: 'object' },
  notifications: { file: 'notifications.json', type: 'array' },
  contact: { file: 'contact.json', type: 'object' },
  settings: { file: 'settings.json', type: 'object' },
  assets: { file: 'assets.json', type: 'object' },
});

const writeQueues = new Map();

const getCollectionConfig = (collection) => {
  const config = COLLECTIONS[collection];

  if (!config) {
    throw new AppError(`Unsupported JSON collection: ${collection}`, 400, {
      allowedCollections: Object.keys(COLLECTIONS),
    });
  }

  return config;
};

const getDefaultData = (collection) => {
  const config = getCollectionConfig(collection);
  if (collection === 'students') {
    return {
      courseCategories: [],
      enquiries: [],
      admissions: [],
      studentRecords: [],
      enrollments: [],
      updatedAt: new Date().toISOString(),
    };
  }
  if (collection === 'contact') {
    return { submissions: [], tickets: [], updatedAt: new Date().toISOString() };
  }
  return config.type === 'array' ? [] : {};
};

const getCollectionPath = (collection) => {
  const config = getCollectionConfig(collection);
  return path.join(DATA_DIR, config.file);
};

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeCollectionData = (collection, data) => {
  const config = getCollectionConfig(collection);

  if (collection === 'students' && Array.isArray(data)) {
    return {
      courseCategories: [],
      enquiries: [],
      admissions: [],
      studentRecords: data,
      enrollments: [],
      updatedAt: new Date().toISOString(),
    };
  }

  if (config.type === 'array') {
    if (!Array.isArray(data)) {
      throw new AppError(`${collection}.json must contain an array.`, 500, { collection });
    }
    return data;
  }

  if (!isPlainObject(data)) {
    throw new AppError(`${collection}.json must contain an object.`, 500, { collection });
  }

  if (collection === 'students') {
    return {
      courseCategories: Array.isArray(data.courseCategories) ? data.courseCategories : [],
      enquiries: Array.isArray(data.enquiries) ? data.enquiries : [],
      admissions: Array.isArray(data.admissions) ? data.admissions : [],
      studentRecords: Array.isArray(data.studentRecords) ? data.studentRecords : [],
      enrollments: Array.isArray(data.enrollments) ? data.enrollments : [],
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  }

  if (collection === 'contact') {
    return {
      submissions: Array.isArray(data.submissions) ? data.submissions : [],
      tickets: Array.isArray(data.tickets) ? data.tickets : [],
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  }

  return data;
};

const validateWritableData = (collection, data) => normalizeCollectionData(collection, data);

const ensureDataFile = async (collection) => {
  const filePath = getCollectionPath(collection);

  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }

    await fs.writeFile(filePath, `${JSON.stringify(getDefaultData(collection), null, 2)}\n`, 'utf8');
  }

  return filePath;
};

const readData = async (collection) => {
  const filePath = await ensureDataFile(collection);
  const rawData = await fs.readFile(filePath, 'utf8');

  if (!rawData.trim()) {
    return getDefaultData(collection);
  }

  try {
    return normalizeCollectionData(collection, JSON.parse(rawData));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Invalid JSON in ${collection}.json`, 500, { filePath, error: error.message });
  }
};

const withCollectionWriteLock = async (collection, operation) => {
  const previous = writeQueues.get(collection) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  const queued = previous.then(() => current, () => current);
  writeQueues.set(collection, queued);

  try {
    await previous;
    return await operation();
  } finally {
    release();
    if (writeQueues.get(collection) === queued) {
      writeQueues.delete(collection);
    }
  }
};

const writeData = async (collection, data) => withCollectionWriteLock(collection, async () => {
  const filePath = await ensureDataFile(collection);
  const validatedData = validateWritableData(collection, data);
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`;
  const payload = `${JSON.stringify(validatedData, null, 2)}\n`;

  JSON.parse(payload);
  await fs.writeFile(temporaryPath, payload, 'utf8');
  await fs.rename(temporaryPath, filePath);

  return validatedData;
});

const createId = (item = {}) => {
  if (item.id) {
    return String(item.id);
  }

  const source = item.title || item.name || item.email || item.phone || crypto.randomUUID();
  const slug = String(source)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || crypto.randomUUID();
};

const addData = async (collection, item) => {
  const config = getCollectionConfig(collection);
  const currentData = await readData(collection);

  if (config.type === 'object') {
    const updatedData = {
      ...currentData,
      ...item,
      updatedAt: new Date().toISOString(),
    };

    return writeData(collection, updatedData);
  }

  const newItem = {
    ...item,
    id: createId(item),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (currentData.some((entry) => String(entry.id) === String(newItem.id))) {
    throw new AppError(`An item with id "${newItem.id}" already exists in ${collection}.`, 409);
  }

  await writeData(collection, [...currentData, newItem]);
  return newItem;
};

const updateData = async (collection, id, updates) => {
  const config = getCollectionConfig(collection);
  const currentData = await readData(collection);

  if (config.type === 'object') {
    const updatedData = {
      ...currentData,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return writeData(collection, updatedData);
  }

  const itemIndex = currentData.findIndex((entry) => String(entry.id) === String(id));

  if (itemIndex === -1) {
    throw new AppError(`No item with id "${id}" exists in ${collection}.`, 404);
  }

  const updatedItem = {
    ...currentData[itemIndex],
    ...updates,
    id: currentData[itemIndex].id,
    updatedAt: new Date().toISOString(),
  };
  const updatedData = [...currentData];
  updatedData[itemIndex] = updatedItem;

  await writeData(collection, updatedData);
  return updatedItem;
};

const deleteData = async (collection, id) => {
  const config = getCollectionConfig(collection);
  const currentData = await readData(collection);

  if (config.type === 'object') {
    if (!id) {
      await writeData(collection, getDefaultData(collection));
      return { deleted: true };
    }

    if (!Object.prototype.hasOwnProperty.call(currentData, id)) {
      throw new AppError(`No setting key "${id}" exists in ${collection}.`, 404);
    }

    const updatedData = { ...currentData };
    delete updatedData[id];
    updatedData.updatedAt = new Date().toISOString();
    await writeData(collection, updatedData);
    return { deleted: true, id };
  }

  const item = currentData.find((entry) => String(entry.id) === String(id));

  if (!item) {
    throw new AppError(`No item with id "${id}" exists in ${collection}.`, 404);
  }

  await writeData(collection, currentData.filter((entry) => String(entry.id) !== String(id)));
  return item;
};

module.exports = {
  COLLECTIONS,
  DATA_DIR,
  addData,
  deleteData,
  readData,
  updateData,
  writeData,
};

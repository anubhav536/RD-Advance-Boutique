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

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const compactString = (value) => String(value ?? '').trim();
const nowIso = () => new Date().toISOString();

const normalizeSlug = (value) => compactString(value)
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return ['true', '1', 'yes', 'on', 'featured', 'active'].includes(compactString(value).toLowerCase());
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toArray = (value) => (Array.isArray(value) ? value : []);

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
      updatedAt: nowIso(),
    };
  }
  if (collection === 'contact') {
    return { submissions: [], tickets: [], updatedAt: nowIso() };
  }
  if (collection === 'assets') {
    return {
      logo: [],
      banners: [],
      gallery: [],
      courses: [],
      products: [],
      favicons: [],
      updatedAt: nowIso(),
    };
  }
  return config.type === 'array' ? [] : {};
};

const getCollectionPath = (collection) => {
  const config = getCollectionConfig(collection);
  return path.join(DATA_DIR, config.file);
};

const createId = (item = {}) => {
  if (item.id) return compactString(item.id);

  const source = item.title || item.name || item.email || item.phone || crypto.randomUUID();
  const slug = normalizeSlug(source);
  return slug || crypto.randomUUID();
};

const normalizeStatus = (value, allowed, fallback) => {
  const normalized = normalizeSlug(value || fallback);
  return allowed.includes(normalized) ? normalized : fallback;
};

const normalizeArrayItem = (collection, item) => {
  if (!isPlainObject(item)) return null;
  const timestamp = item.updatedAt || item.createdAt || nowIso();

  if (collection === 'products') {
    const title = compactString(item.title || item.name || 'Untitled Product');
    const productType = normalizeStatus(item.productType || item.type, ['ready-made', 'boutique', 'affiliate'], 'boutique');
    const stockQuantity = Math.max(0, toNumber(item.stockQuantity ?? item.stock, 0));
    const image = compactString(item.image || item.thumbnail || toArray(item.images)[0] || 'assets/logo.png');
    return {
      ...item,
      id: createId({ ...item, title }),
      title,
      name: title,
      category: compactString(item.category || 'General'),
      productType,
      type: productType,
      price: item.price === undefined || item.price === null || item.price === '' ? 'On request' : item.price,
      discountPrice: item.discountPrice === '' ? null : (item.discountPrice ?? null),
      image,
      images: toArray(item.images).length ? toArray(item.images).map(compactString).filter(Boolean) : [image],
      description: compactString(item.description),
      features: toArray(item.features).map(compactString).filter(Boolean),
      tags: toArray(item.tags).map(compactString).filter(Boolean),
      stockQuantity,
      stock: stockQuantity,
      featured: toBoolean(item.featured, false),
      status: normalizeStatus(item.status, ['active', 'draft', 'inactive', 'out-of-stock'], stockQuantity > 0 ? 'active' : 'out-of-stock'),
      createdAt: item.createdAt || timestamp,
      updatedAt: item.updatedAt || timestamp,
    };
  }

  if (collection === 'gallery') {
    const title = compactString(item.title || item.name || 'Gallery Image');
    return {
      ...item,
      id: createId({ ...item, title }),
      title,
      category: compactString(item.category || 'Boutique'),
      image: compactString(item.image || item.url || 'assets/logo.png'),
      alt: compactString(item.alt || title),
      layout: compactString(item.layout || 'default'),
      featured: toBoolean(item.featured, false),
    };
  }

  if (collection === 'categories') {
    const name = compactString(item.name || item.title || 'Category');
    return {
      ...item,
      id: createId({ ...item, name }),
      name,
      slug: normalizeSlug(item.slug || name),
      description: compactString(item.description),
      status: normalizeStatus(item.status, ['active', 'inactive', 'hidden', 'draft'], 'active'),
    };
  }

  if (collection === 'notifications') {
    const title = compactString(item.title || 'Notification');
    return {
      ...item,
      id: createId({ ...item, title }),
      title,
      message: compactString(item.message),
      scope: compactString(item.scope || 'site'),
      status: normalizeStatus(item.status, ['active', 'draft', 'inactive', 'expired'], 'active'),
      createdAt: item.createdAt || timestamp,
      updatedAt: item.updatedAt || timestamp,
    };
  }

  if (collection === 'orders') {
    return {
      ...item,
      id: createId(item),
      orderNumber: compactString(item.orderNumber || item.id || `RD-${Date.now()}`),
      orderType: normalizeStatus(item.orderType || item.type, ['custom-stitching', 'ready-made'], 'custom-stitching'),
      status: normalizeStatus(item.status, ['pending', 'in-progress', 'ready', 'completed', 'delivered', 'cancelled'], 'pending'),
      customer: isPlainObject(item.customer) ? item.customer : {},
      items: toArray(item.items),
      payment: isPlainObject(item.payment) ? item.payment : { method: 'cod', status: 'not-submitted' },
      createdAt: item.createdAt || timestamp,
      updatedAt: item.updatedAt || timestamp,
    };
  }

  return {
    ...item,
    id: createId(item),
    createdAt: item.createdAt || timestamp,
    updatedAt: item.updatedAt || timestamp,
  };
};

const normalizeCollectionData = (collection, data) => {
  const config = getCollectionConfig(collection);

  if (collection === 'students' && Array.isArray(data)) {
    return {
      courseCategories: [],
      enquiries: [],
      admissions: [],
      studentRecords: data.filter(isPlainObject),
      enrollments: [],
      updatedAt: nowIso(),
    };
  }

  if (config.type === 'array') {
    if (!Array.isArray(data)) {
      throw new AppError(`${collection}.json must contain an array.`, 500, { collection });
    }
    return data.map((item) => normalizeArrayItem(collection, item)).filter(Boolean);
  }

  if (!isPlainObject(data)) {
    throw new AppError(`${collection}.json must contain an object.`, 500, { collection });
  }

  if (collection === 'students') {
    return {
      courseCategories: toArray(data.courseCategories).filter(isPlainObject),
      enquiries: toArray(data.enquiries).filter(isPlainObject),
      admissions: toArray(data.admissions).filter(isPlainObject),
      studentRecords: toArray(data.studentRecords).filter(isPlainObject),
      enrollments: toArray(data.enrollments).filter(isPlainObject),
      updatedAt: data.updatedAt || nowIso(),
    };
  }

  if (collection === 'contact') {
    return {
      submissions: toArray(data.submissions).filter(isPlainObject),
      tickets: toArray(data.tickets).filter(isPlainObject),
      updatedAt: data.updatedAt || nowIso(),
    };
  }

  if (collection === 'assets') {
    return {
      ...getDefaultData('assets'),
      ...data,
      logo: toArray(data.logo).filter(isPlainObject),
      banners: toArray(data.banners).filter(isPlainObject),
      gallery: toArray(data.gallery).filter(isPlainObject),
      courses: toArray(data.courses).filter(isPlainObject),
      products: toArray(data.products).filter(isPlainObject),
      favicons: toArray(data.favicons).filter(isPlainObject),
      updatedAt: data.updatedAt || nowIso(),
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
    if (error.code !== 'ENOENT') throw error;
    await fs.writeFile(filePath, `${JSON.stringify(getDefaultData(collection), null, 2)}\n`, 'utf8');
  }

  return filePath;
};

const backupCorruptFile = async (filePath, rawData) => {
  const backupPath = `${filePath}.corrupt-${Date.now()}.bak`;
  await fs.writeFile(backupPath, rawData, 'utf8');
  return backupPath;
};

const readData = async (collection) => {
  const filePath = await ensureDataFile(collection);
  const rawData = await fs.readFile(filePath, 'utf8');

  if (!rawData.trim()) return getDefaultData(collection);

  try {
    return normalizeCollectionData(collection, JSON.parse(rawData));
  } catch (error) {
    const backupPath = await backupCorruptFile(filePath, rawData);
    const defaultData = getDefaultData(collection);
    await fs.writeFile(filePath, `${JSON.stringify(defaultData, null, 2)}\n`, 'utf8');
    console.error(`Recovered malformed ${collection}.json with default data.`, { filePath, backupPath, error: error.message });
    return defaultData;
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
    if (writeQueues.get(collection) === queued) writeQueues.delete(collection);
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

const addData = async (collection, item) => {
  const config = getCollectionConfig(collection);
  const currentData = await readData(collection);

  if (config.type === 'object') {
    const updatedData = { ...currentData, ...item, updatedAt: nowIso() };
    return writeData(collection, updatedData);
  }

  const newItem = normalizeArrayItem(collection, {
    ...item,
    id: createId(item),
    createdAt: item.createdAt || nowIso(),
    updatedAt: nowIso(),
  });

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
    return writeData(collection, { ...currentData, ...updates, updatedAt: nowIso() });
  }

  const itemIndex = currentData.findIndex((entry) => String(entry.id) === String(id));
  if (itemIndex === -1) throw new AppError(`No item with id "${id}" exists in ${collection}.`, 404);

  const updatedItem = normalizeArrayItem(collection, {
    ...currentData[itemIndex],
    ...updates,
    id: currentData[itemIndex].id,
    createdAt: currentData[itemIndex].createdAt,
    updatedAt: nowIso(),
  });
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
    updatedData.updatedAt = nowIso();
    await writeData(collection, updatedData);
    return { deleted: true, id };
  }

  const item = currentData.find((entry) => String(entry.id) === String(id));
  if (!item) throw new AppError(`No item with id "${id}" exists in ${collection}.`, 404);

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

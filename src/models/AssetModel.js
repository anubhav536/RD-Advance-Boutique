const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const BaseModel = require('./BaseModel');
const AppError = require('../utils/AppError');
const jsonDatabase = require('../utils/jsonDatabase');

const ASSET_COLLECTION = 'assets';
const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads/assets');
const PUBLIC_UPLOAD_ROOT = 'uploads/assets';
const ASSET_TYPES = Object.freeze(['logo', 'banners', 'gallery', 'courses', 'products', 'favicons']);
const SINGLETON_TYPES = Object.freeze(['logo']);
const MIME_EXTENSIONS = Object.freeze({
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
});

const normalizeSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const getInitialStore = () => ASSET_TYPES.reduce((store, type) => ({
  ...store,
  [type]: [],
}), { updatedAt: null });

const getStore = async () => {
  const data = await jsonDatabase.readData(ASSET_COLLECTION);
  const store = getInitialStore();

  ASSET_TYPES.forEach((type) => {
    store[type] = Array.isArray(data[type]) ? data[type] : [];
  });

  store.updatedAt = data.updatedAt || null;
  return store;
};

const writeStore = async (store) => jsonDatabase.writeData(ASSET_COLLECTION, {
  ...ASSET_TYPES.reduce((payload, type) => ({ ...payload, [type]: store[type] || [] }), {}),
  updatedAt: new Date().toISOString(),
});

const validateType = (type) => {
  const normalizedType = normalizeSlug(type);
  if (!ASSET_TYPES.includes(normalizedType)) {
    throw new AppError(`Asset type must be one of: ${ASSET_TYPES.join(', ')}.`, 400, { allowedTypes: ASSET_TYPES });
  }
  return normalizedType;
};

const getExtension = (file) => {
  const mimeType = String(file?.mimeType || '').toLowerCase();
  const extension = MIME_EXTENSIONS[mimeType];

  if (!extension) {
    throw new AppError('Only local image uploads are supported.', 400, { allowedMimeTypes: Object.keys(MIME_EXTENSIONS) });
  }

  return extension;
};

const removeFileIfLocal = async (asset) => {
  if (!asset?.path || !asset.path.startsWith(`${PUBLIC_UPLOAD_ROOT}/`)) return;

  const filePath = path.resolve(__dirname, '../..', asset.path);
  if (!filePath.startsWith(UPLOAD_ROOT)) return;

  await fs.rm(filePath, { force: true });
};

class AssetModel extends BaseModel {
  static get allowedTypes() {
    return ASSET_TYPES;
  }

  static async findAll() {
    return getStore();
  }

  static async findByType(type) {
    const normalizedType = validateType(type);
    const store = await getStore();
    return store[normalizedType];
  }

  static async upload(type, file, payload = {}) {
    const normalizedType = validateType(type);
    const store = await getStore();
    const asset = await AssetModel.saveFile(normalizedType, file, payload);

    if (SINGLETON_TYPES.includes(normalizedType)) {
      await Promise.all(store[normalizedType].map(removeFileIfLocal));
      store[normalizedType] = [asset];
    } else {
      store[normalizedType].push(asset);
    }

    await writeStore(store);
    return asset;
  }

  static async replace(type, id, file, payload = {}) {
    const normalizedType = validateType(type);
    const store = await getStore();
    const assetIndex = store[normalizedType].findIndex((asset) => String(asset.id) === String(id));

    if (assetIndex === -1) {
      throw new AppError(`No ${normalizedType} asset with id "${id}" exists.`, 404);
    }

    const previousAsset = store[normalizedType][assetIndex];
    const replacement = await AssetModel.saveFile(normalizedType, file, {
      ...previousAsset,
      ...payload,
      id: previousAsset.id,
      createdAt: previousAsset.createdAt,
    });

    store[normalizedType][assetIndex] = replacement;
    await removeFileIfLocal(previousAsset);
    await writeStore(store);
    return replacement;
  }

  static async delete(type, id) {
    const normalizedType = validateType(type);
    const store = await getStore();
    const asset = store[normalizedType].find((entry) => String(entry.id) === String(id));

    if (!asset) {
      throw new AppError(`No ${normalizedType} asset with id "${id}" exists.`, 404);
    }

    store[normalizedType] = store[normalizedType].filter((entry) => String(entry.id) !== String(id));
    await removeFileIfLocal(asset);
    await writeStore(store);
    return asset;
  }

  static async saveFile(type, file, payload = {}) {
    if (!file?.buffer?.length) {
      throw new AppError('An image file is required.', 400);
    }

    const extension = getExtension(file);
    const now = new Date().toISOString();
    const title = String(payload.title || payload.name || file.originalName || type).trim();
    const preferredId = SINGLETON_TYPES.includes(type) ? type : (payload.id || title || crypto.randomUUID());
    const id = normalizeSlug(preferredId) || crypto.randomUUID();
    const directory = path.join(UPLOAD_ROOT, type);
    const fileName = `${id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
    const filePath = path.join(directory, fileName);
    const publicPath = `${PUBLIC_UPLOAD_ROOT}/${type}/${fileName}`;
    const url = `/${publicPath}`;

    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(filePath, file.buffer);

    return {
      id,
      type,
      title,
      alt: String(payload.alt || title).trim(),
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      path: publicPath,
      url,
      createdAt: payload.createdAt || now,
      updatedAt: now,
    };
  }
}

module.exports = AssetModel;

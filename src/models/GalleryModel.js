const BaseModel = require('./BaseModel');
const AppError = require('../utils/AppError');
const jsonDatabase = require('../utils/jsonDatabase');

const GALLERY_COLLECTION = 'gallery';
const GALLERY_LAYOUTS = Object.freeze(['default', 'wide', 'tall']);
const DEFAULT_LAYOUT = 'default';

const normalizeSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return ['true', '1', 'yes', 'on', 'featured'].includes(String(value).trim().toLowerCase());
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

const normalizeLayout = (layout = DEFAULT_LAYOUT) => {
  const normalizedLayout = normalizeSlug(layout || DEFAULT_LAYOUT);

  if (!GALLERY_LAYOUTS.includes(normalizedLayout)) {
    throw new AppError('Gallery layout must be default, wide, or tall.', 400, {
      allowedLayouts: GALLERY_LAYOUTS,
    });
  }

  return normalizedLayout;
};

class GalleryModel extends BaseModel {
  static get constants() {
    return {
      GALLERY_LAYOUTS,
    };
  }

  static async findAll(filters = {}) {
    const images = await jsonDatabase.readData(GALLERY_COLLECTION);

    if (!Array.isArray(images)) {
      throw new AppError('gallery.json must contain an array.', 500);
    }

    return images.filter((image) => GalleryModel.matchesFilters(image, filters));
  }

  static async findById(id) {
    const images = await GalleryModel.findAll();
    const image = images.find((entry) => String(entry.id) === String(id));

    if (!image) {
      throw new AppError(`No gallery image with id "${id}" exists.`, 404);
    }

    return image;
  }

  static async create(payload) {
    const images = await GalleryModel.findAll();
    const image = GalleryModel.normalizePayload(payload, { partial: false });
    image.id = GalleryModel.createUniqueId({ ...image, id: payload.id }, images);
    image.createdAt = payload.createdAt || new Date().toISOString();
    image.updatedAt = new Date().toISOString();

    await jsonDatabase.writeData(GALLERY_COLLECTION, [...images, image]);
    return image;
  }

  static async update(id, payload) {
    const images = await GalleryModel.findAll();
    const itemIndex = images.findIndex((entry) => String(entry.id) === String(id));

    if (itemIndex === -1) {
      throw new AppError(`No gallery image with id "${id}" exists.`, 404);
    }

    const currentImage = images[itemIndex];
    const updates = GalleryModel.normalizePayload(payload, { partial: true, currentImage });
    const updatedImage = {
      ...currentImage,
      ...updates,
      id: currentImage.id,
      createdAt: currentImage.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const updatedImages = [...images];
    updatedImages[itemIndex] = updatedImage;

    await jsonDatabase.writeData(GALLERY_COLLECTION, updatedImages);
    return updatedImage;
  }

  static async delete(id) {
    const images = await GalleryModel.findAll();
    const image = images.find((entry) => String(entry.id) === String(id));

    if (!image) {
      throw new AppError(`No gallery image with id "${id}" exists.`, 404);
    }

    await jsonDatabase.writeData(
      GALLERY_COLLECTION,
      images.filter((entry) => String(entry.id) !== String(id)),
    );

    return image;
  }

  static async getCategories() {
    const images = await GalleryModel.findAll();
    const categoryNames = [...new Set(images.map((image) => image.category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

    return categoryNames.map((category) => ({
      id: normalizeSlug(category),
      name: category,
      imageCount: images.filter((image) => image.category === category).length,
      featuredCount: images.filter((image) => image.category === category && toBoolean(image.featured)).length,
    }));
  }

  static matchesFilters(image, filters = {}) {
    const normalizedCategory = normalizeSlug(filters.category);
    const normalizedLayout = normalizeSlug(filters.layout);
    const normalizedSearch = normalizeSlug(filters.search);

    if (normalizedCategory && normalizeSlug(image.category) !== normalizedCategory) {
      return false;
    }

    if (normalizedLayout && normalizeSlug(image.layout || DEFAULT_LAYOUT) !== normalizedLayout) {
      return false;
    }

    if (filters.featured !== undefined && toBoolean(image.featured) !== toBoolean(filters.featured)) {
      return false;
    }

    if (normalizedSearch) {
      const searchableText = normalizeSlug([
        image.title,
        image.name,
        image.category,
        image.description,
        image.alt,
        ...(Array.isArray(image.tags) ? image.tags : []),
      ].join(' '));

      if (!searchableText.includes(normalizedSearch)) {
        return false;
      }
    }

    return true;
  }

  static normalizePayload(payload = {}, { partial = false, currentImage = {} } = {}) {
    const normalized = {};
    const title = payload.title ?? payload.name;
    const image = payload.image ?? payload.url ?? payload.src;

    if (!partial || title !== undefined) {
      if (!String(title || '').trim()) {
        throw new AppError('Gallery image title is required.', 400);
      }

      normalized.title = String(title).trim();
      normalized.name = normalized.title;
    }

    if (!partial || payload.category !== undefined) {
      if (!String(payload.category || '').trim()) {
        throw new AppError('Gallery image category is required.', 400);
      }

      normalized.category = String(payload.category).trim();
    }

    if (!partial || image !== undefined) {
      if (!String(image || '').trim()) {
        throw new AppError('Gallery image URL/path is required.', 400);
      }

      normalized.image = String(image).trim();
    }

    if (!partial || payload.alt !== undefined) {
      const fallbackTitle = normalized.title || currentImage.title || currentImage.name || 'Gallery image';
      normalized.alt = String(payload.alt || fallbackTitle).trim();
    }

    if (!partial || payload.layout !== undefined) {
      normalized.layout = normalizeLayout(payload.layout || currentImage.layout || DEFAULT_LAYOUT);
    }

    if (!partial || payload.featured !== undefined) {
      normalized.featured = toBoolean(payload.featured, false);
    }

    if (payload.description !== undefined) {
      normalized.description = String(payload.description || '').trim();
    }

    if (payload.tags !== undefined) {
      normalized.tags = toStringArray(payload.tags);
    }

    if (payload.sortOrder !== undefined || payload.order !== undefined) {
      const sortOrder = Number(payload.sortOrder ?? payload.order);

      if (!Number.isFinite(sortOrder)) {
        throw new AppError('Gallery image sortOrder must be a valid number.', 400);
      }

      normalized.sortOrder = sortOrder;
    }

    return normalized;
  }

  static createUniqueId(image, images) {
    const baseId = normalizeSlug(image.id || image.title || image.name);
    let candidate = baseId || `gallery-${Date.now()}`;
    let suffix = 2;

    while (images.some((entry) => String(entry.id) === candidate)) {
      candidate = `${baseId}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }
}

module.exports = GalleryModel;

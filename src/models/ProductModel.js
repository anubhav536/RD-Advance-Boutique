const BaseModel = require('./BaseModel');
const AppError = require('../utils/AppError');
const jsonDatabase = require('../utils/jsonDatabase');

const PRODUCT_COLLECTION = 'products';

const PRODUCT_TYPES = Object.freeze(['ready-made', 'boutique', 'affiliate']);
const PRODUCT_STATUSES = Object.freeze(['active', 'draft', 'inactive', 'out-of-stock']);

const DEFAULT_PRODUCT_TYPE = 'boutique';
const DEFAULT_STATUS = 'active';

const normalizeSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const uniqueValues = (items) => [...new Set(items.filter(Boolean))];

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

const toImages = (value, fallbackImage) => {
  const images = toStringArray(value);

  if (images.length > 0) {
    return images;
  }

  return fallbackImage ? [fallbackImage] : [];
};

const normalizeType = (type) => {
  const normalizedType = normalizeSlug(type || DEFAULT_PRODUCT_TYPE);

  if (!PRODUCT_TYPES.includes(normalizedType)) {
    throw new AppError('Product type must be ready-made, boutique, or affiliate.', 400, {
      allowedTypes: PRODUCT_TYPES,
    });
  }

  return normalizedType;
};

const normalizeStatus = (status, stockQuantity) => {
  const defaultStatus = stockQuantity === 0 ? 'out-of-stock' : DEFAULT_STATUS;
  const normalizedStatus = normalizeSlug(status || defaultStatus);

  if (!PRODUCT_STATUSES.includes(normalizedStatus)) {
    throw new AppError('Product status must be active, draft, inactive, or out-of-stock.', 400, {
      allowedStatuses: PRODUCT_STATUSES,
    });
  }

  return normalizedStatus;
};

const isTruthyQuery = (value) => value !== undefined && toBoolean(value, true);

class ProductModel extends BaseModel {
  static get constants() {
    return {
      PRODUCT_STATUSES,
      PRODUCT_TYPES,
    };
  }

  static async findAll(filters = {}) {
    const products = await jsonDatabase.readData(PRODUCT_COLLECTION);

    if (!Array.isArray(products)) {
      throw new AppError('products.json must contain an array.', 500);
    }

    return products.filter((product) => ProductModel.matchesFilters(product, filters));
  }

  static async findById(id) {
    const products = await ProductModel.findAll();
    const product = products.find((entry) => String(entry.id) === String(id));

    if (!product) {
      throw new AppError(`No product with id "${id}" exists.`, 404);
    }

    return product;
  }

  static async create(payload) {
    const products = await ProductModel.findAll();
    const product = ProductModel.normalizePayload(payload, { partial: false });
    product.id = ProductModel.createUniqueId({ ...product, id: payload.id }, products);
    product.createdAt = payload.createdAt || new Date().toISOString();
    product.updatedAt = new Date().toISOString();

    await jsonDatabase.writeData(PRODUCT_COLLECTION, [...products, product]);
    return product;
  }

  static async update(id, payload) {
    const products = await ProductModel.findAll();
    const itemIndex = products.findIndex((entry) => String(entry.id) === String(id));

    if (itemIndex === -1) {
      throw new AppError(`No product with id "${id}" exists.`, 404);
    }

    const currentProduct = products[itemIndex];
    const updates = ProductModel.normalizePayload(payload, { partial: true, currentProduct });
    const updatedProduct = {
      ...currentProduct,
      ...updates,
      id: currentProduct.id,
      createdAt: currentProduct.createdAt,
      updatedAt: new Date().toISOString(),
    };

    if (updatedProduct.stockQuantity === 0 && !payload.status) {
      updatedProduct.status = 'out-of-stock';
    }

    const updatedProducts = [...products];
    updatedProducts[itemIndex] = updatedProduct;

    await jsonDatabase.writeData(PRODUCT_COLLECTION, updatedProducts);
    return updatedProduct;
  }

  static async delete(id) {
    const products = await ProductModel.findAll();
    const product = products.find((entry) => String(entry.id) === String(id));

    if (!product) {
      throw new AppError(`No product with id "${id}" exists.`, 404);
    }

    await jsonDatabase.writeData(
      PRODUCT_COLLECTION,
      products.filter((entry) => String(entry.id) !== String(id)),
    );

    return product;
  }

  static async updateStock(id, stockQuantity) {
    const parsedStockQuantity = toNumber(stockQuantity, 'stockQuantity', {
      required: true,
      integer: true,
      minimum: 0,
    });

    return ProductModel.update(id, { stockQuantity: parsedStockQuantity });
  }

  static async getCategories() {
    const products = await ProductModel.findAll();
    const categories = uniqueValues(products.map((product) => product.category)).sort((a, b) => a.localeCompare(b));

    return categories.map((category) => ({
      id: normalizeSlug(category),
      name: category,
      productCount: products.filter((product) => product.category === category).length,
    }));
  }

  static matchesFilters(product, filters = {}) {
    const normalizedSearch = normalizeSlug(filters.search);
    const normalizedCategory = normalizeSlug(filters.category);
    const normalizedType = normalizeSlug(filters.type);
    const normalizedStatus = normalizeSlug(filters.status);

    if (normalizedCategory && normalizeSlug(product.category) !== normalizedCategory) {
      return false;
    }

    if (normalizedType && normalizeSlug(product.productType || product.type) !== normalizedType) {
      return false;
    }

    if (normalizedStatus && normalizeSlug(product.status) !== normalizedStatus) {
      return false;
    }

    if (filters.featured !== undefined && toBoolean(product.featured) !== toBoolean(filters.featured)) {
      return false;
    }

    if (filters.inStock !== undefined && isTruthyQuery(filters.inStock) && Number(product.stockQuantity || 0) <= 0) {
      return false;
    }

    if (normalizedSearch) {
      const searchableText = normalizeSlug([
        product.title,
        product.name,
        product.category,
        product.description,
        product.productType,
        product.type,
        ...(Array.isArray(product.tags) ? product.tags : []),
      ].join(' '));

      if (!searchableText.includes(normalizedSearch)) {
        return false;
      }
    }

    return true;
  }

  static normalizePayload(payload = {}, { partial = false, currentProduct = {} } = {}) {
    const normalized = {};
    const title = payload.title ?? payload.name;
    const image = payload.image ?? payload.thumbnail ?? (Array.isArray(payload.images) ? payload.images[0] : undefined);
    const stockQuantity = toNumber(payload.stockQuantity ?? payload.stock, 'stockQuantity', {
      required: !partial,
      integer: true,
      minimum: 0,
    });

    if (!partial || title !== undefined) {
      if (!String(title || '').trim()) {
        throw new AppError('Product title is required.', 400);
      }

      normalized.title = String(title).trim();
      normalized.name = normalized.title;
    }

    if (!partial || payload.category !== undefined) {
      if (!String(payload.category || '').trim()) {
        throw new AppError('Product category is required.', 400);
      }

      normalized.category = String(payload.category).trim();
    }

    if (!partial || payload.productType !== undefined || payload.type !== undefined) {
      normalized.productType = normalizeType(payload.productType ?? payload.type ?? currentProduct.productType);
      normalized.type = normalized.productType;
    }

    if (!partial || payload.price !== undefined) {
      normalized.price = payload.price === undefined ? 'On request' : payload.price;
    }

    if (payload.discountPrice !== undefined) {
      normalized.discountPrice = payload.discountPrice === '' ? null : payload.discountPrice;
    }

    if (!partial || payload.description !== undefined) {
      normalized.description = String(payload.description || '').trim();
    }

    if (payload.details !== undefined || payload.longDescription !== undefined) {
      normalized.details = payload.details || String(payload.longDescription || '').trim();
    }

    if (payload.features !== undefined) {
      normalized.features = toStringArray(payload.features);
    }

    if (payload.tags !== undefined) {
      normalized.tags = toStringArray(payload.tags);
    }

    if (!partial || image !== undefined || payload.images !== undefined) {
      normalized.image = image || currentProduct.image || '';
      normalized.images = toImages(payload.images, normalized.image);
    }

    if (payload.link !== undefined || payload.affiliateUrl !== undefined) {
      normalized.link = String(payload.link ?? payload.affiliateUrl ?? '').trim();
      normalized.affiliateUrl = normalized.link;
    }

    if (payload.sku !== undefined) {
      normalized.sku = String(payload.sku || '').trim();
    }

    if (payload.featured !== undefined || !partial) {
      normalized.featured = toBoolean(payload.featured, false);
    }

    if (stockQuantity !== undefined) {
      normalized.stockQuantity = stockQuantity;
      normalized.stock = stockQuantity;
    }

    if (!partial || payload.status !== undefined || stockQuantity !== undefined) {
      const nextStockQuantity = stockQuantity ?? currentProduct.stockQuantity ?? currentProduct.stock;
      normalized.status = normalizeStatus(payload.status ?? currentProduct.status, Number(nextStockQuantity));
    }

    return normalized;
  }

  static createUniqueId(product, products) {
    const baseId = normalizeSlug(product.id || product.title || product.name);
    let candidate = baseId || `product-${Date.now()}`;
    let suffix = 2;

    while (products.some((entry) => String(entry.id) === candidate)) {
      candidate = `${baseId}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }
}

module.exports = ProductModel;

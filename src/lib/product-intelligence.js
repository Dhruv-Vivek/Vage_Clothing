import 'server-only';

import { randomUUID } from 'node:crypto';
import { query } from '@/lib/db';
import { getProductEventsCollection } from '@/lib/mongodb';

export const PRODUCT_EVENT_TYPES = new Set([
  'PRODUCT_VIEW',
  'SEARCH',
  'PRODUCT_LIST_VIEW',
  'CATEGORY_BROWSE',
  'ADD_TO_CART',
  'CART_VIEW',
  'REMOVE_FROM_CART',
  'CART_QUANTITY_UPDATE',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_EVENT_TYPES_WITH_PRODUCT = new Set([
  'PRODUCT_VIEW', 'ADD_TO_CART', 'REMOVE_FROM_CART', 'CART_QUANTITY_UPDATE',
]);

function invalid(message, status = 400) {
  const error = new Error(message);
  error.statusCode = status;
  return error;
}

function positiveId(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw invalid(label + ' is invalid.');
  return number;
}

function safePath(value) {
  if (typeof value !== 'string') return '/';
  const path = value.trim().split('?')[0].slice(0, 160);
  return /^\/[A-Za-z0-9/_-]*$/.test(path) ? path : '/';
}

function cleanSearchTerm(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

async function productSnapshot(productId, variantId) {
  const rows = await query(
    "SELECT p.product_id, p.name AS product_name, p.category_id, " +
    "c.name AS category_name, c.slug AS category_slug " +
    "FROM products p LEFT JOIN categories c ON c.category_id = p.category_id " +
    "WHERE p.product_id = ? AND p.status = 'ACTIVE' LIMIT 1",
    [productId]
  );
  if (!rows.length) throw invalid('Product was not found or is not active.', 404);

  let unitPrice = null;
  let resolvedVariantId = null;
  if (variantId !== null) {
    const variants = await query(
      "SELECT pv.variant_id, COALESCE(pv.price_override, p.base_price) AS unit_price " +
      "FROM product_variants pv INNER JOIN products p ON p.product_id = pv.product_id " +
      "WHERE pv.variant_id = ? AND pv.product_id = ? AND pv.is_active = 1 LIMIT 1",
      [variantId, productId]
    );
    if (!variants.length) throw invalid('Product variant was not found or is not active.', 404);
    resolvedVariantId = Number(variants[0].variant_id);
    unitPrice = Number(variants[0].unit_price);
  }

  return {
    productId: Number(rows[0].product_id),
    productName: String(rows[0].product_name),
    categoryId: rows[0].category_id === null ? null : Number(rows[0].category_id),
    categoryName: rows[0].category_name || null,
    categorySlug: rows[0].category_slug || null,
    variantId: resolvedVariantId,
    unitPrice,
  };
}

async function categorySnapshot(categorySlug) {
  if (categorySlug === undefined || categorySlug === null || categorySlug === '' || categorySlug === 'All') return null;
  if (typeof categorySlug !== 'string' || !/^[a-z0-9-]{1,120}$/i.test(categorySlug)) {
    throw invalid('Category is invalid.');
  }
  const rows = await query(
    "SELECT category_id, name, slug FROM categories WHERE slug = ? AND is_active = 1 LIMIT 1",
    [categorySlug.toLowerCase()]
  );
  if (!rows.length) throw invalid('Category was not found.', 404);
  return {
    categoryId: Number(rows[0].category_id),
    categoryName: String(rows[0].name),
    categorySlug: String(rows[0].slug),
  };
}

export async function recordProductEvent(payload, user) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw invalid('A JSON object is required.');
  const eventType = String(payload.eventType || '').toUpperCase();
  if (!PRODUCT_EVENT_TYPES.has(eventType)) throw invalid('Unsupported product intelligence event.');

  const eventId = typeof payload.eventId === 'string' && payload.eventId.length <= 80
    ? payload.eventId
    : randomUUID();
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(eventId)) throw invalid('Event ID is invalid.');

  const anonymousId = typeof payload.anonymousId === 'string' && UUID_PATTERN.test(payload.anonymousId)
    ? payload.anonymousId
    : null;
  const sessionId = typeof payload.sessionId === 'string' && UUID_PATTERN.test(payload.sessionId)
    ? payload.sessionId
    : null;
  if (!anonymousId || !sessionId) throw invalid('Browser analytics identifiers are invalid.');

  const userId = Number.isSafeInteger(Number(user?.id)) && Number(user.id) > 0 ? Number(user.id) : null;
  const visitorKey = userId ? 'user:' + userId : 'guest:' + anonymousId;

  const document = {
    eventId,
    eventType,
    visitorKey,
    userId,
    anonymousId,
    sessionId,
    path: safePath(payload.path),
    createdAt: new Date(),
  };

  if (PRODUCT_EVENT_TYPES_WITH_PRODUCT.has(eventType)) {
    const productId = positiveId(payload.productId, 'Product ID');
    const variantId = payload.variantId === undefined || payload.variantId === null || payload.variantId === ''
      ? null
      : positiveId(payload.variantId, 'Variant ID');
    Object.assign(document, await productSnapshot(productId, variantId));

    if (eventType === 'ADD_TO_CART' || eventType === 'CART_QUANTITY_UPDATE') {
      const quantity = Number(payload.quantity);
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
        throw invalid('Quantity must be a whole number between 1 and 10.');
      }
      document.quantity = quantity;
    }
  }

  if (eventType === 'SEARCH') {
    const searchTerm = cleanSearchTerm(payload.searchTerm);
    if (searchTerm.length < 2) throw invalid('Search term is too short after privacy filtering.');
    document.searchTerm = searchTerm;
  }

  if (eventType === 'CATEGORY_BROWSE' || eventType === 'PRODUCT_LIST_VIEW') {
    const category = await categorySnapshot(payload.categorySlug);
    if (category) Object.assign(document, category);
  }

  if (eventType === 'CART_VIEW') {
    const itemCount = Number(payload.itemCount || 0);
    if (!Number.isSafeInteger(itemCount) || itemCount < 0 || itemCount > 100) {
      throw invalid('Cart item count is invalid.');
    }
    document.itemCount = itemCount;
  }

  const collection = await getProductEventsCollection();
  try {
    await collection.insertOne(document);
    return { inserted: true, duplicate: false };
  } catch (error) {
    if (error?.code === 11000) return { inserted: false, duplicate: true };
    throw error;
  }
}

function sumIf(condition) {
  return { $sum: { $cond: [condition, 1, 0] } };
}

export async function getProductIntelligenceReport(days = 30) {
  const periodDays = [7, 30, 90].includes(Number(days)) ? Number(days) : 30;
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const collection = await getProductEventsCollection();
  const match = { createdAt: { $gte: since } };

  const [summaryRows, popularProducts, categoryTrends, topSearches, dailyTrend, eventTypes] = await Promise.all([
    collection.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        visitors: { $addToSet: '$visitorKey' },
        productViews: sumIf({ $eq: ['$eventType', 'PRODUCT_VIEW'] }),
        searches: sumIf({ $eq: ['$eventType', 'SEARCH'] }),
        addToCart: sumIf({ $eq: ['$eventType', 'ADD_TO_CART'] }),
        browseEvents: sumIf({ $in: ['$eventType', ['PRODUCT_LIST_VIEW', 'CATEGORY_BROWSE']] }),
        cartViews: sumIf({ $eq: ['$eventType', 'CART_VIEW'] }),
        removals: sumIf({ $eq: ['$eventType', 'REMOVE_FROM_CART'] }),
      } },
      { $project: {
        _id: 0,
        totalEvents: 1,
        uniqueVisitors: { $size: '$visitors' },
        productViews: 1,
        searches: 1,
        addToCart: 1,
        browseEvents: 1,
        cartViews: 1,
        removals: 1,
      } },
    ]).toArray(),

    collection.aggregate([
      { $match: { ...match, eventType: { $in: ['PRODUCT_VIEW', 'ADD_TO_CART'] }, productId: { $type: 'number' } } },
      { $sort: { createdAt: 1 } },
      { $group: {
        _id: '$productId',
        productName: { $last: '$productName' },
        categoryName: { $last: '$categoryName' },
        views: sumIf({ $eq: ['$eventType', 'PRODUCT_VIEW'] }),
        addToCart: sumIf({ $eq: ['$eventType', 'ADD_TO_CART'] }),
        unitsAdded: { $sum: { $cond: [{ $eq: ['$eventType', 'ADD_TO_CART'] }, { $ifNull: ['$quantity', 0] }, 0] } },
      } },
      { $sort: { addToCart: -1, views: -1, productName: 1 } },
      { $limit: 10 },
      { $project: { _id: 0, productId: '$_id', productName: 1, categoryName: 1, views: 1, addToCart: 1, unitsAdded: 1 } },
    ]).toArray(),

    collection.aggregate([
      { $match: { ...match, categoryId: { $type: 'number' }, eventType: { $in: ['CATEGORY_BROWSE', 'PRODUCT_LIST_VIEW', 'PRODUCT_VIEW', 'ADD_TO_CART'] } } },
      { $sort: { createdAt: 1 } },
      { $group: {
        _id: '$categoryId',
        categoryName: { $last: '$categoryName' },
        categoryBrowses: sumIf({ $eq: ['$eventType', 'CATEGORY_BROWSE'] }),
        listViews: sumIf({ $eq: ['$eventType', 'PRODUCT_LIST_VIEW'] }),
        productViews: sumIf({ $eq: ['$eventType', 'PRODUCT_VIEW'] }),
        addToCart: sumIf({ $eq: ['$eventType', 'ADD_TO_CART'] }),
      } },
      { $sort: { productViews: -1, addToCart: -1, categoryName: 1 } },
      { $limit: 10 },
      { $project: { _id: 0, categoryId: '$_id', categoryName: 1, categoryBrowses: 1, listViews: 1, productViews: 1, addToCart: 1 } },
    ]).toArray(),

    collection.aggregate([
      { $match: { ...match, eventType: 'SEARCH', searchTerm: { $type: 'string' } } },
      { $group: { _id: '$searchTerm', searches: { $sum: 1 }, visitors: { $addToSet: '$visitorKey' } } },
      { $sort: { searches: -1, _id: 1 } },
      { $limit: 10 },
      { $project: { _id: 0, searchTerm: '$_id', searches: 1, uniqueVisitors: { $size: '$visitors' } } },
    ]).toArray(),

    collection.aggregate([
      { $match: match },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
        events: { $sum: 1 },
        productViews: sumIf({ $eq: ['$eventType', 'PRODUCT_VIEW'] }),
        searches: sumIf({ $eq: ['$eventType', 'SEARCH'] }),
        addToCart: sumIf({ $eq: ['$eventType', 'ADD_TO_CART'] }),
      } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', events: 1, productViews: 1, searches: 1, addToCart: 1 } },
    ]).toArray(),

    collection.aggregate([
      { $match: match },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $project: { _id: 0, eventType: '$_id', count: 1 } },
    ]).toArray(),
  ]);

  const summary = summaryRows[0] || {
    totalEvents: 0, uniqueVisitors: 0, productViews: 0, searches: 0,
    addToCart: 0, browseEvents: 0, cartViews: 0, removals: 0,
  };

  return {
    periodDays,
    generatedAt: new Date().toISOString(),
    summary,
    popularProducts,
    categoryTrends,
    topSearches,
    dailyTrend,
    eventTypes,
  };
}

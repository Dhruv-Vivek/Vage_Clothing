import 'server-only';

/**
 * EMBEDDED MYSQL: server-side catalogue/admin SQL, including SELECT, INSERT, UPDATE and joined product queries.
 * See backend/README.md for the database/backend walkthrough.
 */

import { query } from '@/lib/db';
import {
  HttpError,
  PRODUCT_STATUSES,
  cleanImageUrl,
  cleanInt,
  cleanMoney,
  cleanText,
  run,
  slugify,
  toId,
} from '@/lib/admin';

/** Validate product fields. With partial=true only supplied keys are returned (for PATCH). */
export function parseProductBody(body, { partial = false } = {}) {
  const has = (key) => body[key] !== undefined;
  const out = {};

  if (!partial || has('name')) out.name = cleanText(body.name, { label: 'Name', max: 180, required: true });
  if (!partial || has('categoryId')) out.category_id = toId(body.categoryId, 'Category');
  if (!partial || has('brand')) out.brand = cleanText(body.brand, { label: 'Brand', max: 100 }) || 'Vage';
  if (!partial || has('description')) {
    out.description = cleanText(body.description, { label: 'Description', max: 5000, multiline: true });
  }
  if (!partial || has('basePrice')) out.base_price = cleanMoney(body.basePrice, 'Price');
  if (!partial || has('status')) {
    const status = body.status ?? 'DRAFT';
    if (!PRODUCT_STATUSES.includes(status)) throw new HttpError(400, 'Status is invalid.');
    out.status = status;
  }
  if (!partial || has('imageUrl')) out.image_url = cleanImageUrl(body.imageUrl);
  if (!partial || has('material')) out.material = cleanText(body.material, { label: 'Material', max: 100 });
  if (!partial || has('fitType')) out.fit_type = cleanText(body.fitType, { label: 'Fit', max: 60 });
  if (!partial || has('productOrigin')) {
    out.product_origin = cleanText(body.productOrigin, { label: 'Origin', max: 80 });
  }
  return out;
}

export function parseVariantBody(body) {
  const sku = cleanText(body.sku, { label: 'SKU', max: 64 });
  if (sku && !/^[A-Za-z0-9._-]+$/.test(sku)) {
    throw new HttpError(400, 'SKU may only contain letters, numbers, dots, dashes and underscores.');
  }
  return {
    size: cleanText(body.size, { label: 'Size', max: 32, required: true }),
    color: cleanText(body.color, { label: 'Colour', max: 64, required: true }),
    sku,
    priceOverride: cleanMoney(body.priceOverride, 'Price override', { nullable: true }),
    stock: body.stock === undefined || body.stock === '' ? 0 : cleanInt(body.stock, 'Stock'),
  };
}

function skuPart(text, length) {
  return String(text).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length) || 'X';
}

export function makeSku(productId, size, color) {
  return `VAGE-${productId}-${skuPart(size, 8)}-${skuPart(color, 10)}`;
}

/** Slug from the name, made unique with -2, -3 … Slugs never change after creation so URLs stay stable. */
export async function uniqueSlug(connection, name) {
  const base = slugify(name);
  for (let i = 1; i <= 50; i += 1) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const rows = await run(connection, 'SELECT 1 FROM products WHERE slug = ? LIMIT 1', [candidate]);
    if (!rows.length) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Insert a variant plus its inventory row (and an audit-log entry for any opening stock). */
export async function insertVariant(connection, productId, input, adminId) {
  // Check size+colour first: MySQL would otherwise report the (auto-generated) SKU clash and hide the real cause.
  const clash = await run(
    connection,
    'SELECT 1 FROM product_variants WHERE product_id = ? AND size = ? AND color = ? LIMIT 1',
    [productId, input.size, input.color]
  );
  if (clash.length) {
    throw new HttpError(409, `This product already has a ${input.size} / ${input.color} variant.`);
  }

  const sku = input.sku || makeSku(productId, input.size, input.color);
  const result = await run(
    connection,
    `INSERT INTO product_variants (product_id, sku, size, color, price_override)
     VALUES (?, ?, ?, ?, ?)`,
    [productId, sku, input.size, input.color, input.priceOverride ?? null]
  );
  const variantId = Number(result.insertId);

  await run(connection, 'INSERT INTO inventory (variant_id, stock_quantity) VALUES (?, ?)', [
    variantId,
    input.stock,
  ]);
  if (input.stock > 0) {
    await run(
      connection,
      `INSERT INTO inventory_log
         (variant_id, change_type, quantity_change, stock_before, stock_after, reason, changed_by)
       VALUES (?, 'STOCK_IN', ?, 0, ?, 'Initial stock', ?)`,
      [variantId, input.stock, input.stock, adminId]
    );
  }
  return { variantId, sku };
}

export function mapAdminProduct(row) {
  return {
    id: Number(row.product_id),
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    description: row.description || '',
    categoryId: Number(row.category_id),
    category: row.category_name,
    basePrice: Number(row.base_price),
    status: row.status,
    imageUrl: row.image_url || null,
    material: row.material || '',
    fitType: row.fit_type || '',
    productOrigin: row.product_origin || '',
    createdAt: row.created_at,
  };
}

export function mapVariant(row) {
  return {
    variantId: Number(row.variant_id),
    sku: row.sku,
    size: row.size,
    color: row.color,
    priceOverride: row.price_override === null ? null : Number(row.price_override),
    isActive: Boolean(row.is_active),
    stock: Number(row.stock || 0),
  };
}

/** Load one product with all its variants (active and inactive) and stock. Returns null if missing. */
export async function loadProduct(productId) {
  const rows = await query(
    `SELECT p.*, c.name AS category_name
       FROM products AS p
       JOIN categories AS c ON c.category_id = p.category_id
      WHERE p.product_id = ?
      LIMIT 1`,
    [productId]
  );
  if (!rows.length) return null;

  const variants = await query(
    `SELECT pv.variant_id, pv.sku, pv.size, pv.color, pv.price_override, pv.is_active,
            COALESCE(i.stock_quantity, 0) AS stock
       FROM product_variants AS pv
       LEFT JOIN inventory AS i ON i.variant_id = pv.variant_id
      WHERE pv.product_id = ?
      ORDER BY pv.variant_id ASC`,
    [productId]
  );

  return { product: mapAdminProduct(rows[0]), variants: variants.map(mapVariant) };
}

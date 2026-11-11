import 'server-only';

/**
 * EMBEDDED MYSQL: reads products, variants, inventory, coupons and membership discounts inside the checkout transaction.
 * See backend/README.md for the database/backend walkthrough.
 */

import { HttpError, toCents } from '@/lib/guards';

export const DELIVERY = {
  standard: { key: 'standard', enumValue: 'STANDARD', amount: 99 },
  express: { key: 'express', enumValue: 'EXPRESS', amount: 199 },
  priority: { key: 'priority', enumValue: 'PRIORITY', amount: 250 },
};

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

/** Pricing shared by the read-only quote endpoint and the locked order-creation transaction. */
export async function priceCheckout(connection, {
  userId, items, deliveryMethod, couponCode = '', lock = true, strictCoupon = true,
}) {
  const suffix = lock ? ' FOR UPDATE' : '';
  const delivery = DELIVERY[String(deliveryMethod || 'standard').toLowerCase()];
  if (!delivery) throw new HttpError(422, 'Choose a valid delivery option.');
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    throw new HttpError(422, 'Your cart must contain between 1 and 20 variants.');
  }
  const ids = items.map((item) => Number(item.variantId));
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
    throw new HttpError(422, 'Your cart contains an invalid or duplicate variant.');
  }
  const placeholders = ids.map(() => '?').join(',');
  const [variants] = await connection.execute(
    `SELECT pv.variant_id, pv.sku, pv.size, pv.color, pv.is_active,
            p.product_id, p.name AS product_name, p.status AS product_status,
            COALESCE(pv.price_override, p.base_price) AS unit_price,
            COALESCE(i.stock_quantity, 0) AS stock_quantity
       FROM product_variants pv
       INNER JOIN products p ON p.product_id = pv.product_id
       LEFT JOIN inventory i ON i.variant_id = pv.variant_id
      WHERE pv.variant_id IN (${placeholders})
      ORDER BY pv.variant_id${suffix}`,
    ids
  );
  if (variants.length !== items.length) {
    throw new HttpError(422, 'One or more selected variants are no longer available. Refresh your cart.');
  }
  const variantById = new Map(variants.map((row) => [Number(row.variant_id), row]));
  let subtotalCents = 0;
  for (const item of items) {
    const variant = variantById.get(Number(item.variantId));
    const quantity = Number(item.quantity);
    if (!variant || !variant.is_active || variant.product_status !== 'ACTIVE') {
      throw new HttpError(422, 'Your cart contains an inactive product or variant.');
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new HttpError(422, 'Each variant quantity must be between 1 and 10.');
    }
    if (Number(variant.stock_quantity) < quantity) {
      throw new HttpError(422, `Insufficient stock for ${variant.product_name} (${variant.size}, ${variant.color}). Available: ${Number(variant.stock_quantity)}.`);
    }
    subtotalCents += toCents(variant.unit_price) * quantity;
  }

  const [memberships] = await connection.execute(
    `SELECT mp.plan_code, mp.discount_percent, mp.free_shipping_minimum, mp.free_shipping_methods
       FROM user_memberships um
       INNER JOIN membership_plans mp ON mp.plan_id = um.plan_id
      WHERE um.user_id = ? AND um.status = 'ACTIVE'
        AND um.starts_at <= NOW() AND um.expires_at > NOW() AND mp.is_active = 1
      ORDER BY um.expires_at DESC LIMIT 1${suffix}`,
    [userId]
  );
  const activePlan = memberships[0] || null;
  const membershipDiscountCents = activePlan
    ? Math.min(subtotalCents, Math.round(subtotalCents * Number(activePlan.discount_percent) / 100))
    : 0;

  let coupon = null;
  let couponError = null;
  let couponDiscountCents = 0;
  const code = String(couponCode || '').trim().toUpperCase();
  if (code) {
    try {
      const [rows] = await connection.execute(
        `SELECT coupon_id, coupon_code, discount_type, discount_value, min_order_amount,
                max_discount, usage_limit, usage_count,
                (starts_at <= NOW()) AS is_started,
                (expires_at > NOW()) AS is_unexpired, is_active
           FROM coupons WHERE coupon_code = ? LIMIT 1${suffix}`,
        [code]
      );
      const row = rows[0];
      if (!row || !row.is_active) throw new HttpError(422, 'Coupon is invalid or inactive.');
      if (!row.is_started || !row.is_unexpired) throw new HttpError(422, 'Coupon is outside its valid date range.');
      if (row.usage_limit !== null && Number(row.usage_count) >= Number(row.usage_limit)) {
        throw new HttpError(422, 'Coupon usage limit has been reached.');
      }
      const discountedSubtotal = subtotalCents - membershipDiscountCents;
      if (discountedSubtotal < toCents(row.min_order_amount)) {
        throw new HttpError(422, `Your order does not meet the minimum amount of ₹${Number(row.min_order_amount)} for this coupon.`);
      }
      const requested = row.discount_type === 'PERCENT'
        ? Math.round(discountedSubtotal * Number(row.discount_value) / 100)
        : toCents(row.discount_value);
      const capped = row.max_discount === null ? requested : Math.min(requested, toCents(row.max_discount));
      couponDiscountCents = Math.max(0, Math.min(discountedSubtotal, capped));
      coupon = { id: Number(row.coupon_id), code: row.coupon_code };
    } catch (error) {
      if (strictCoupon || !(error instanceof HttpError)) throw error;
      couponError = error.message;
    }
  }

  const discountCents = Math.min(subtotalCents, membershipDiscountCents + couponDiscountCents);
  const methods = parseJsonArray(activePlan?.free_shipping_methods);
  const minimum = activePlan ? toCents(activePlan.free_shipping_minimum) : Infinity;
  const shippingIsFree = Boolean(activePlan) && methods.includes(delivery.key) && subtotalCents >= minimum;
  const shippingCents = shippingIsFree ? 0 : toCents(delivery.amount);
  const totalCents = subtotalCents - discountCents + shippingCents;
  if (totalCents <= 0) throw new HttpError(422, 'The payable amount must be greater than zero.');

  return {
    variantById, delivery,
    membership: activePlan ? {
      planCode: String(activePlan.plan_code).toLowerCase(),
      discountPercent: Number(activePlan.discount_percent),
    } : null,
    coupon, couponError, subtotalCents, membershipDiscountCents,
    couponDiscountCents, discountCents, shippingCents, shippingIsFree, totalCents,
  };
}

import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { getRazorpay, getRazorpayPublicKey } from '@/lib/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DELIVERY = {
  standard: { enumValue: 'STANDARD', amount: 99 },
  express: { enumValue: 'EXPRESS', amount: 199 },
  priority: { enumValue: 'PRIORITY', amount: 250 },
};

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function amount(centsValue) {
  return Number((centsValue / 100).toFixed(2));
}

function parseJson(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function validateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'A valid checkout payload is required.' };
  }

  const idempotencyKey = typeof body.idempotencyKey === 'string'
    ? body.idempotencyKey.trim()
    : '';
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(idempotencyKey)) {
    return { error: 'A valid checkout idempotency key is required.' };
  }

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) {
    return { error: 'Your cart must contain between 1 and 20 distinct variants.' };
  }

  const itemMap = new Map();
  for (const item of body.items) {
    const variantId = Number(item?.variantId);
    const quantity = Number(item?.quantity);
    if (!Number.isSafeInteger(variantId) || variantId <= 0) {
      return { error: 'A cart item is missing its selected size/colour variant. Open the product page and select a variant again.' };
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
      return { error: 'Each variant quantity must be between 1 and 10.' };
    }
    if (itemMap.has(variantId)) {
      return { error: 'Duplicate variants were found in the cart. Refresh the cart and try again.' };
    }
    itemMap.set(variantId, quantity);
  }

  const shipping = body.shippingInfo || {};
  const fullName = typeof shipping.fullName === 'string' ? shipping.fullName.trim() : '';
  const phoneDigits = typeof shipping.phone === 'string' ? shipping.phone.replace(/\D/g, '') : '';
  const address = typeof shipping.address === 'string' ? shipping.address.trim() : '';
  const city = typeof shipping.city === 'string' ? shipping.city.trim() : '';
  const state = typeof shipping.state === 'string' ? shipping.state.trim() : '';
  const pincode = typeof shipping.pincode === 'string' ? shipping.pincode.trim() : '';

  if (fullName.length < 2 || fullName.length > 120) return { error: 'Enter a valid recipient name.' };
  if (![10, 12].includes(phoneDigits.length) || (phoneDigits.length === 12 && !phoneDigits.startsWith('91'))) {
    return { error: 'Enter a valid Indian phone number with 10 digits (the +91 prefix is added automatically).' };
  }
  if (!address || address.length > 200) return { error: 'Address must contain 1 to 200 characters.' };
  if (!city || city.length > 100) return { error: 'Enter a valid city.' };
  if (!state || state.length > 100) return { error: 'Enter a valid state.' };
  if (!/^[0-9]{6}$/.test(pincode)) return { error: 'Enter a valid 6-digit Indian PIN code.' };

  const deliveryKey = String(body.deliveryMethod || 'standard').toLowerCase();
  if (!DELIVERY[deliveryKey]) return { error: 'Choose a valid delivery option.' };

  const couponCode = typeof body.couponCode === 'string'
    ? body.couponCode.trim().toUpperCase().slice(0, 40)
    : '';

  const items = [...itemMap.entries()]
    .map(([variantId, quantity]) => ({ variantId, quantity }))
    .sort((a, b) => a.variantId - b.variantId);

  const normalised = {
    items,
    fullName,
    phone: phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits,
    address,
    city,
    state,
    pincode,
    deliveryMethod: deliveryKey,
    couponCode,
  };

  const requestHash = createHash('sha256')
    .update(JSON.stringify(normalised))
    .digest('hex');

  return {
    value: {
      idempotencyKey,
      requestHash,
      ...normalised,
    },
  };
}

async function findExistingCheckout(userId, idempotencyKey, requestHash) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
        k.request_hash, k.order_id, k.razorpay_order_id,
        o.order_number, o.total_amount, o.payment_status, o.status
     FROM checkout_idempotency_keys k
     LEFT JOIN orders o ON o.order_id = k.order_id
     WHERE k.user_id = ? AND k.idempotency_key = ?
     LIMIT 1`,
    [userId, idempotencyKey]
  );

  if (!rows.length) return null;
  const row = rows[0];

  if (row.request_hash !== requestHash) {
    return { conflict: 'This idempotency key was already used with different checkout details.' };
  }
  if (
    !row.order_id ||
    !row.razorpay_order_id ||
    row.payment_status !== 'PENDING' ||
    row.status !== 'PENDING'
  ) {
    return { conflict: 'This checkout attempt is no longer active. Start checkout again.' };
  }

  return {
    existing: true,
    orderId: Number(row.order_id),
    orderNumber: row.order_number,
    amount: cents(row.total_amount),
    currency: 'INR',
    razorpayOrderId: row.razorpay_order_id,
    keyId: getRazorpayPublicKey(),
  };
}

async function compensateFailedGatewayCreate(orderId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.execute(
      `SELECT status, payment_status, coupon_id FROM orders WHERE order_id = ? FOR UPDATE`,
      [orderId]
    );

    if (orders.length && orders[0].payment_status !== 'PAID' && orders[0].status === 'PENDING') {
      const [items] = await connection.execute(
        'SELECT variant_id, quantity FROM order_items WHERE order_id = ?',
        [orderId]
      );
      for (const item of items) {
        await connection.execute(
          'UPDATE inventory SET stock_quantity = stock_quantity + ? WHERE variant_id = ?',
          [Number(item.quantity), Number(item.variant_id)]
        );
      }
      await connection.execute(
        `UPDATE payments SET status = 'FAILED'
         WHERE order_id = ? AND status = 'PENDING'`,
        [orderId]
      );
      await connection.execute(
        `UPDATE orders
         SET status = 'CANCELLED', payment_status = 'FAILED'
         WHERE order_id = ? AND payment_status <> 'PAID'`,
        [orderId]
      );
      if (orders[0].coupon_id) {
        await connection.execute(
          'UPDATE coupons SET usage_count = GREATEST(usage_count - 1, 0) WHERE coupon_id = ?',
          [orders[0].coupon_id]
        );
      }
    }

    await connection.execute(
      'DELETE FROM checkout_idempotency_keys WHERE order_id = ?',
      [orderId]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('Failed to compensate an incomplete Razorpay order:', error);
  } finally {
    connection.release();
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return jsonError('Please sign in before checkout.', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  const validation = validateBody(body);
  if (validation.error) return jsonError(validation.error, 400);
  const input = validation.value;

  try {
    // Reuse a successful create-order response when the client retries with
    // the same idempotency key after a network timeout.
    const prior = await findExistingCheckout(user.id, input.idempotencyKey, input.requestHash);
    if (prior?.conflict) return jsonError(prior.conflict, 409);
    if (prior?.existing) return NextResponse.json(prior);

    const pool = getPool();
    const connection = await pool.getConnection();
    let orderId;
    let paymentId;
    let orderNumber;
    let totalCents;

    try {
      await connection.beginTransaction();

      await connection.execute(
        `INSERT INTO checkout_idempotency_keys
           (user_id, idempotency_key, request_hash)
         VALUES (?, ?, ?)`,
        [user.id, input.idempotencyKey, input.requestHash]
      );

      const [addressResult] = await connection.execute(
        `INSERT INTO addresses
           (user_id, recipient_name, phone, address_line1, city, state_name, postal_code, country)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'India')`,
        [user.id, input.fullName, input.phone, input.address, input.city, input.state, input.pincode]
      );
      const addressId = Number(addressResult.insertId);

      const variantIds = input.items.map((item) => item.variantId);
      const placeholders = variantIds.map(() => '?').join(',');
      const [variants] = await connection.execute(
        `SELECT
            pv.variant_id, pv.sku, pv.size, pv.color, pv.is_active,
            p.product_id, p.name AS product_name, p.status AS product_status,
            COALESCE(pv.price_override, p.base_price) AS unit_price,
            COALESCE(i.stock_quantity, 0) AS stock_quantity
         FROM product_variants pv
         INNER JOIN products p ON p.product_id = pv.product_id
         LEFT JOIN inventory i ON i.variant_id = pv.variant_id
         WHERE pv.variant_id IN (${placeholders})
         ORDER BY pv.variant_id
         FOR UPDATE`,
        variantIds
      );

      if (variants.length !== input.items.length) {
        throw new Error('One or more selected product variants are no longer available. Refresh your cart.');
      }

      const variantById = new Map(variants.map((row) => [Number(row.variant_id), row]));
      let subtotalCents = 0;

      for (const item of input.items) {
        const variant = variantById.get(item.variantId);
        if (!variant || !variant.is_active || variant.product_status !== 'ACTIVE') {
          throw new Error('Your cart contains an inactive product or variant. Remove it and try again.');
        }
        if (Number(variant.stock_quantity) < item.quantity) {
          throw new Error(`Insufficient stock for ${variant.product_name} (${variant.size}, ${variant.color}). Available: ${Number(variant.stock_quantity)}.`);
        }
        subtotalCents += cents(variant.unit_price) * item.quantity;
      }

      const [memberships] = await connection.execute(
        `SELECT mp.plan_code, mp.discount_percent, mp.free_shipping_minimum,
                mp.free_shipping_methods
         FROM user_memberships um
         INNER JOIN membership_plans mp ON mp.plan_id = um.plan_id
         WHERE um.user_id = ?
           AND um.status = 'ACTIVE'
           AND um.starts_at <= NOW()
           AND um.expires_at > NOW()
           AND mp.is_active = 1
         ORDER BY um.expires_at DESC
         LIMIT 1
         FOR UPDATE`,
        [user.id]
      );
      const membership = memberships[0] || null;
      const membershipDiscountCents = membership
        ? Math.min(subtotalCents, Math.round(subtotalCents * Number(membership.discount_percent) / 100))
        : 0;

      let couponId = null;
      let couponDiscountCents = 0;
      if (input.couponCode) {
        const [coupons] = await connection.execute(
          `SELECT coupon_id, discount_type, discount_value, min_order_amount,
                  max_discount, usage_limit, usage_count,
                  (starts_at <= NOW()) AS is_started,
                  (expires_at > NOW()) AS is_unexpired,
                  is_active
           FROM coupons
           WHERE coupon_code = ?
           LIMIT 1
           FOR UPDATE`,
          [input.couponCode]
        );
        const coupon = coupons[0];
        if (!coupon || !coupon.is_active) throw new Error('Coupon is invalid or inactive.');
        if (!coupon.is_started || !coupon.is_unexpired) {
          throw new Error('Coupon is outside its valid date range.');
        }
        if (coupon.usage_limit !== null && Number(coupon.usage_count) >= Number(coupon.usage_limit)) {
          throw new Error('Coupon usage limit has been reached.');
        }
        const discountedSubtotal = subtotalCents - membershipDiscountCents;
        if (discountedSubtotal < cents(coupon.min_order_amount)) {
          throw new Error('Your order does not meet the minimum amount for this coupon.');
        }
        if (coupon.discount_type === 'PERCENT') {
          couponDiscountCents = Math.round(discountedSubtotal * Number(coupon.discount_value) / 100);
        } else {
          couponDiscountCents = cents(coupon.discount_value);
        }
        if (coupon.max_discount !== null) {
          couponDiscountCents = Math.min(couponDiscountCents, cents(coupon.max_discount));
        }
        couponDiscountCents = Math.max(0, Math.min(discountedSubtotal, couponDiscountCents));
        couponId = Number(coupon.coupon_id);
      }

      const discountCents = Math.min(subtotalCents, membershipDiscountCents + couponDiscountCents);
      const delivery = DELIVERY[input.deliveryMethod];
      const methods = parseJson(membership?.free_shipping_methods, []);
      const freeShippingMinimumCents = membership ? cents(membership.free_shipping_minimum) : Infinity;
      const shippingCents = membership
        && methods.includes(input.deliveryMethod)
        && subtotalCents >= freeShippingMinimumCents
          ? 0
          : cents(delivery.amount);
      totalCents = subtotalCents - discountCents + shippingCents;

      if (totalCents <= 0) throw new Error('The payable amount must be greater than zero.');

      orderNumber = `VG-${randomBytes(7).toString('hex').toUpperCase()}`;
      const subtotal = amount(subtotalCents);
      const discount = amount(discountCents);
      const shippingAmount = amount(shippingCents);
      const total = amount(totalCents);

      const [orderResult] = await connection.execute(
        `INSERT INTO orders
           (order_number, user_id, address_id, coupon_id, status, payment_status,
            subtotal, discount_amount, coupon_discount_amount,
            membership_discount_amount, shipping_amount, delivery_method, total_amount)
         VALUES (?, ?, ?, ?, 'PENDING', 'PENDING', ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderNumber, user.id, addressId, couponId,
          subtotal, discount, amount(couponDiscountCents),
          amount(membershipDiscountCents), shippingAmount,
          delivery.enumValue, total,
        ]
      );
      orderId = Number(orderResult.insertId);

      for (const item of input.items) {
        const variant = variantById.get(item.variantId);
        const [stockResult] = await connection.execute(
          `UPDATE inventory
           SET stock_quantity = stock_quantity - ?
           WHERE variant_id = ? AND stock_quantity >= ?`,
          [item.quantity, item.variantId, item.quantity]
        );
        if (stockResult.affectedRows !== 1) {
          throw new Error(`Stock changed while checking out ${variant.product_name}. Please review your cart.`);
        }

        await connection.execute(
          `INSERT INTO order_items
             (order_id, variant_id, product_name, sku, size, color,
              unit_price, quantity, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId, item.variantId, variant.product_name, variant.sku,
            variant.size, variant.color, Number(variant.unit_price),
            item.quantity, amount(cents(variant.unit_price) * item.quantity),
          ]
        );
      }

      const [paymentResult] = await connection.execute(
        `INSERT INTO payments (order_id, payment_method, status, amount)
         VALUES (?, 'RAZORPAY', 'PENDING', ?)`,
        [orderId, total]
      );
      paymentId = Number(paymentResult.insertId);

      if (couponId) {
        await connection.execute(
          `UPDATE coupons SET usage_count = usage_count + 1
           WHERE coupon_id = ?
             AND (usage_limit IS NULL OR usage_count < usage_limit)`,
          [couponId]
        );
      }

      await connection.execute(
        `UPDATE checkout_idempotency_keys
         SET order_id = ?
         WHERE user_id = ? AND idempotency_key = ?`,
        [orderId, user.id, input.idempotencyKey]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();

      if (error?.code === 'ER_DUP_ENTRY') {
        const existing = await findExistingCheckout(user.id, input.idempotencyKey, input.requestHash);
        if (existing?.existing) return NextResponse.json(existing);
        if (existing?.conflict) return jsonError(existing.conflict, 409);
      }
      if (error instanceof Error && /invalid|inactive|stock|variant|cart|coupon|amount|PIN|name|phone|city|state/i.test(error.message)) {
        return jsonError(error.message, 422);
      }
      throw error;
    } finally {
      connection.release();
    }

    try {
      const razorpayOrder = await getRazorpay().orders.create({
        amount: totalCents,
        currency: 'INR',
        receipt: orderNumber,
        notes: {
          vage_order_id: String(orderId),
          vage_order_number: orderNumber,
          vage_user_id: String(user.id),
        },
      });

      const connection2 = await pool.getConnection();
      try {
        await connection2.beginTransaction();
        await connection2.execute(
          `INSERT INTO order_payment_gateways
             (payment_id, gateway, gateway_order_id, status)
           VALUES (?, 'RAZORPAY', ?, 'CREATED')`,
          [paymentId, razorpayOrder.id]
        );
        await connection2.execute(
          `UPDATE checkout_idempotency_keys
           SET razorpay_order_id = ?
           WHERE user_id = ? AND idempotency_key = ?`,
          [razorpayOrder.id, user.id, input.idempotencyKey]
        );
        await connection2.commit();
      } catch (error) {
        await connection2.rollback();
        throw error;
      } finally {
        connection2.release();
      }

      return NextResponse.json({
        orderId,
        orderNumber,
        amount: totalCents,
        currency: 'INR',
        razorpayOrderId: razorpayOrder.id,
        keyId: getRazorpayPublicKey(),
      });
    } catch (error) {
      await compensateFailedGatewayCreate(orderId);
      console.error('Razorpay order creation failed:', error);
      return jsonError('Unable to start payment right now. Your cart has been kept; please try again.', 502);
    }
  } catch (error) {
    console.error('[POST /api/checkout/create-order] Checkout failed:', error);
    return jsonError('Unable to prepare checkout. Please refresh your cart and try again.', 500);
  }
}

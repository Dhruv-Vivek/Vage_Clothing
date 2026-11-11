// EMBEDDED MYSQL: checkout is a server-side transaction containing SELECT ... FOR UPDATE, INSERT order/payment rows and conditional UPDATE inventory statements.
import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { userRoute } from '@/lib/api';
import { resolveDelivery } from '@/lib/shipping';
import { stampLatestHistory } from '@/lib/orders';
import { HttpError, cleanText, readJson, toId, withTransaction, run } from '@/lib/validate';
import { PAYMENT_METHOD_LABELS } from '@/lib/order-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function fromCents(value) {
  return Number((Number(value || 0) / 100).toFixed(2));
}

async function withDeadlockRetry(action, attempts = 3) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      if (error?.code !== 'ER_LOCK_DEADLOCK' || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 40));
    }
  }
}

/**
 * COD checkout is committed entirely in MySQL. The browser submits only the
 * address, delivery choice and coupon; catalogue prices and inventory are read
 * again under row locks before an order can be created.
 */
export const POST = userRoute(async ({ request, user }) => {
  const body = await readJson(request);
  const addressId = toId(body.addressId, 'Delivery address');
  const delivery = resolveDelivery(body.deliveryOption, user.membership);
  const couponCode = (cleanText(body.couponCode, { label: 'Coupon code', max: 40 }) || '').toUpperCase();
  const paymentMethod = String(body.paymentMethod || 'COD').trim().toUpperCase();

  if (paymentMethod !== 'COD') {
    throw new HttpError(400, 'This checkout currently supports Cash on Delivery only.');
  }

  const placed = await withDeadlockRetry(() => withTransaction(async (connection) => {
    // Serialise checkout and cart changes for this customer.
    const users = await run(
      connection,
      'SELECT user_id FROM users WHERE user_id = ? AND is_active = 1 FOR UPDATE',
      [user.id]
    );
    if (!users.length) throw new HttpError(401, 'Your account is not available. Please sign in again.');

    const carts = await run(
      `SELECT cart_id
         FROM carts
        WHERE user_id = ? AND status = 'ACTIVE'
        ORDER BY cart_id DESC
        LIMIT 1
        FOR UPDATE`,
      [user.id]
    );
    if (!carts.length) throw new HttpError(400, 'Your cart is empty.');
    const cartId = Number(carts[0].cart_id);

    const addresses = await run(
      'SELECT address_id FROM addresses WHERE address_id = ? AND user_id = ? FOR UPDATE',
      [addressId, user.id]
    );
    if (!addresses.length) throw new HttpError(400, 'Choose a saved delivery address that belongs to your account.');

    const items = await run(
      `SELECT ci.variant_id, ci.quantity, pv.sku, pv.size, pv.color,
              pv.is_active AS variant_active, p.product_id, p.name AS product_name,
              p.status AS product_status,
              COALESCE(pv.price_override, p.base_price) AS unit_price,
              COALESCE(i.stock_quantity, 0) AS stock_quantity
         FROM cart_items ci
         INNER JOIN product_variants pv ON pv.variant_id = ci.variant_id
         INNER JOIN products p ON p.product_id = pv.product_id
         LEFT JOIN inventory i ON i.variant_id = pv.variant_id
        WHERE ci.cart_id = ?
        ORDER BY ci.variant_id
        FOR UPDATE`,
      [cartId]
    );

    if (!items.length) throw new HttpError(400, 'Your cart is empty.');
    if (items.length > 20) throw new HttpError(400, 'Your cart has too many distinct variants. Remove some items and try again.');

    let subtotalCents = 0;
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!item.variant_active || item.product_status !== 'ACTIVE') {
        throw new HttpError(409, `${item.product_name} is no longer available. Please review your cart.`);
      }
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
        throw new HttpError(409, 'A cart quantity is invalid. Please review your cart.');
      }
      const stock = Number(item.stock_quantity);
      if (stock < quantity) {
        throw new HttpError(409, stock === 0
          ? `${item.product_name} (${item.size}, ${item.color}) is out of stock.`
          : `Only ${stock} of ${item.product_name} (${item.size}, ${item.color}) remain in stock.`);
      }
      subtotalCents += toCents(item.unit_price) * quantity;
    }

    let couponId = null;
    let couponDiscountCents = 0;
    if (couponCode) {
      const coupons = await run(
        `SELECT coupon_id, discount_type, discount_value, min_order_amount,
                max_discount, usage_limit, usage_count, is_active,
                (starts_at <= NOW()) AS is_started,
                (expires_at > NOW()) AS is_unexpired
           FROM coupons
          WHERE coupon_code = ?
          LIMIT 1
          FOR UPDATE`,
        [couponCode]
      );
      const coupon = coupons[0];
      if (!coupon || !coupon.is_active || !coupon.is_started || !coupon.is_unexpired) {
        throw new HttpError(400, 'This coupon is not active right now.');
      }
      if (coupon.usage_limit !== null && Number(coupon.usage_count) >= Number(coupon.usage_limit)) {
        throw new HttpError(400, 'This coupon has been fully used.');
      }
      if (subtotalCents < toCents(coupon.min_order_amount)) {
        throw new HttpError(400, 'Your cart does not meet the minimum amount for this coupon.');
      }

      const requestedCents = coupon.discount_type === 'PERCENT'
        ? Math.round(subtotalCents * Number(coupon.discount_value) / 100)
        : toCents(coupon.discount_value);
      const cappedCents = coupon.max_discount === null
        ? requestedCents
        : Math.min(requestedCents, toCents(coupon.max_discount));
      couponDiscountCents = Math.max(0, Math.min(subtotalCents, cappedCents));
      couponId = Number(coupon.coupon_id);
    }

    const shippingCents = toCents(delivery.amount);
    const totalCents = subtotalCents - couponDiscountCents + shippingCents;
    if (totalCents <= 0) throw new HttpError(400, 'The payable amount must be greater than zero.');

    const orderNumber = `VG-${randomBytes(7).toString('hex').toUpperCase()}`;
    const subtotal = fromCents(subtotalCents);
    const discountAmount = fromCents(couponDiscountCents);
    const shippingAmount = fromCents(shippingCents);
    const totalAmount = fromCents(totalCents);

    const orderResult = await run(
      connection,
      `INSERT INTO orders
         (order_number, user_id, contact_email, address_id, coupon_id,
          status, payment_status, subtotal, discount_amount,
          coupon_discount_amount, membership_discount_amount,
          shipping_amount, delivery_method, total_amount)
       VALUES (?, ?, ?, ?, ?, 'PENDING', 'PENDING', ?, ?, ?, 0.00, ?, ?, ?)`,
      [
        orderNumber, user.id, user.email, addressId, couponId,
        subtotal, discountAmount, discountAmount, shippingAmount,
        delivery.enumValue || delivery.id.toUpperCase(), totalAmount,
      ]
    );
    const orderId = Number(orderResult.insertId);

    for (const item of items) {
      const variantId = Number(item.variant_id);
      const quantity = Number(item.quantity);
      const stockUpdate = await run(
        connection,
        `UPDATE inventory
            SET stock_quantity = stock_quantity - ?
          WHERE variant_id = ? AND stock_quantity >= ?`,
        [quantity, variantId, quantity]
      );
      if (stockUpdate.affectedRows !== 1) {
        throw new HttpError(409, `Stock for ${item.product_name} changed during checkout. Please refresh your cart.`);
      }

      await run(
        connection,
        `INSERT INTO order_items
           (order_id, variant_id, product_name, sku, size, color,
            unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId, variantId, item.product_name, item.sku, item.size, item.color,
          fromCents(toCents(item.unit_price)), quantity,
          fromCents(toCents(item.unit_price) * quantity),
        ]
      );
    }

    await run(
      connection,
      `INSERT INTO payments (order_id, payment_method, status, amount)
       VALUES (?, 'COD', 'PENDING', ?)`,
      [orderId, totalAmount]
    );

    if (couponId) {
      const couponUpdate = await run(
        `UPDATE coupons
            SET usage_count = usage_count + 1
          WHERE coupon_id = ?
            AND (usage_limit IS NULL OR usage_count < usage_limit)`,
        [couponId]
      );
      if (couponUpdate.affectedRows !== 1) {
        throw new HttpError(409, 'This coupon has just reached its usage limit. Please remove it and try again.');
      }
    }

    const cartUpdate = await run(
      `UPDATE carts SET status = 'CHECKED_OUT'
        WHERE cart_id = ? AND status = 'ACTIVE'`,
      [cartId]
    );
    if (cartUpdate.affectedRows !== 1) {
      throw new HttpError(409, 'Your cart changed during checkout. Refresh and try again.');
    }

    await stampLatestHistory(
      connection,
      orderId,
      user.id,
      `Order placed: ${delivery.name} (${delivery.days}), ${PAYMENT_METHOD_LABELS[paymentMethod]}`
    );

    return { orderId, orderNumber, subtotal, discountAmount, shippingAmount, totalAmount };
  }));

  return NextResponse.json(placed, { status: 201 });
});

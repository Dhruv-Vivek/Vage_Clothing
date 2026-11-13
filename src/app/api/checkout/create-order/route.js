import { NextResponse } from 'next/server';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { getRazorpay, getRazorpayPublicKey } from '@/lib/razorpay';
import { DELIVERY, priceCheckout } from '@/lib/checkout-pricing';
import { getConfiguredPaymentProvider } from '@/lib/payments/config';
import { createCashfreeOrder } from '@/lib/payments/cashfree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';



function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function amount(centsValue) {
  return Number((centsValue / 100).toFixed(2));
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
  const email = typeof shipping.email === 'string' ? shipping.email.trim().toLowerCase() : '';
  const phoneDigits = typeof shipping.phone === 'string' ? shipping.phone.replace(/\D/g, '') : '';
  const address = typeof shipping.address === 'string' ? shipping.address.trim() : '';
  const city = typeof shipping.city === 'string' ? shipping.city.trim() : '';
  const state = typeof shipping.state === 'string' ? shipping.state.trim() : '';
  const pincode = typeof shipping.pincode === 'string' ? shipping.pincode.trim() : '';

  if (fullName.length < 2 || fullName.length > 120) return { error: 'Enter a valid recipient name.' };
  if (email.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email address for order updates.' };
  }
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
    email,
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
        k.gateway_order_id, k.payment_session_id, k.payment_provider,
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

  const provider = String(row.payment_provider || (row.razorpay_order_id ? 'RAZORPAY' : '')).toUpperCase();
  const gatewayOrderId = row.gateway_order_id || row.razorpay_order_id;
  if (!row.order_id || !gatewayOrderId || row.payment_status !== 'PENDING' || row.status !== 'PENDING') {
    return { conflict: 'This checkout attempt is no longer active. Start checkout again.' };
  }

  const common = {
    existing: true,
    orderId: Number(row.order_id),
    orderNumber: row.order_number,
    amount: cents(row.total_amount),
    currency: 'INR',
    paymentProvider: provider,
  };

  if (provider === 'DEMO') return { ...common, demoMode: true };
  if (provider === 'CASHFREE') {
    if (!row.payment_session_id) return { conflict: 'The Cashfree session is incomplete. Start checkout again.' };
    return { ...common, cashfreeOrderId: gatewayOrderId, paymentSessionId: row.payment_session_id, cashfreeEnvironment: process.env.CASHFREE_ENV || 'sandbox' };
  }
  if (provider === 'RAZORPAY') {
    return { ...common, razorpayOrderId: gatewayOrderId, keyId: getRazorpayPublicKey() };
  }
  return { conflict: 'This checkout uses an unsupported payment provider. Start checkout again.' };
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
    console.error('Failed to compensate an incomplete payment-provider order:', error);
  } finally {
    connection.release();
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return jsonError('Please sign in before checkout.', 401);

  let provider;
  try {
    provider = getConfiguredPaymentProvider();
  } catch (error) {
    return jsonError(error.message || 'Payment provider is not configured.', 503);
  }

  // VAGE checkout is configured for Razorpay Standard Checkout only.
  // Reject Demo/Cashfree before creating an order or reserving inventory.
  if (provider !== 'RAZORPAY') {
    return jsonError('Razorpay is required for checkout. Set PAYMENT_PROVIDER=RAZORPAY in .env.local and restart the server.', 503);
  }

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

      const pricing = await priceCheckout(connection, {
        userId: user.id,
        items: input.items,
        deliveryMethod: input.deliveryMethod,
        couponCode: input.couponCode,
        lock: true,
        strictCoupon: true,
      });
      const {
        variantById, delivery, subtotalCents, membershipDiscountCents,
        couponDiscountCents, discountCents, shippingCents,
      } = pricing;
      const couponId = pricing.coupon?.id ?? null;
      totalCents = pricing.totalCents;

      orderNumber = `VG-${randomBytes(7).toString('hex').toUpperCase()}`;
      const subtotal = amount(subtotalCents);
      const discount = amount(discountCents);
      const shippingAmount = amount(shippingCents);
      const total = amount(totalCents);

      const [orderResult] = await connection.execute(
        `INSERT INTO orders
           (order_number, user_id, contact_email, address_id, coupon_id, status, payment_status,
            subtotal, discount_amount, coupon_discount_amount,
            membership_discount_amount, shipping_amount, delivery_method, total_amount)
         VALUES (?, ?, ?, ?, ?, 'PENDING', 'PENDING', ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderNumber, user.id, input.email, addressId, couponId,
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
         VALUES (?, ?, 'PENDING', ?)`,
        [orderId, provider, total]
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
      let gatewayOrderId;
      let paymentSessionId = null;
      let response;

      if (provider === 'DEMO') {
        gatewayOrderId = `demo_vage_${orderId}_${randomBytes(8).toString('hex')}`;
        response = {
          orderId,
          orderNumber,
          amount: totalCents,
          currency: 'INR',
          paymentProvider: 'DEMO',
          demoMode: true,
        };
      } else if (provider === 'CASHFREE') {
        const baseUrl = new URL(process.env.APP_BASE_URL || new URL(request.url).origin);
        const returnUrl = new URL('/order-success', baseUrl);
        returnUrl.searchParams.set('orderId', String(orderId));
        returnUrl.searchParams.set('provider', 'CASHFREE');
        // Cashfree substitutes this placeholder with its order ID on return.
        const cashfreeReturnUrl = `${returnUrl.toString()}&order_id={order_id}`;

        const notifyUrl = baseUrl.protocol === 'https:'
          ? new URL('/api/webhooks/cashfree', baseUrl).toString()
          : undefined;

        const cashfreeOrder = await createCashfreeOrder({
          orderId: `vage_${orderId}_${randomBytes(5).toString('hex')}`,
          amount: amount(totalCents),
          customer: {
            id: user.id,
            name: input.fullName,
            email: input.email,
            phone: input.phone.slice(-10),
          },
          returnUrl: cashfreeReturnUrl,
          notifyUrl,
          idempotencyKey: randomUUID(),
        });

        gatewayOrderId = cashfreeOrder.orderId;
        paymentSessionId = cashfreeOrder.paymentSessionId;
        response = {
          orderId,
          orderNumber,
          amount: totalCents,
          currency: 'INR',
          paymentProvider: 'CASHFREE',
          cashfreeOrderId: gatewayOrderId,
          paymentSessionId,
          cashfreeEnvironment: cashfreeOrder.environment,
        };
      } else if (provider === 'RAZORPAY') {
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
        gatewayOrderId = razorpayOrder.id;
        response = {
          orderId,
          orderNumber,
          amount: totalCents,
          currency: 'INR',
          paymentProvider: 'RAZORPAY',
          razorpayOrderId: gatewayOrderId,
          keyId: getRazorpayPublicKey(),
        };
      } else {
        throw new Error('Unsupported payment provider.');
      }

      const connection2 = await pool.getConnection();
      try {
        await connection2.beginTransaction();
        await connection2.execute(
          `INSERT INTO order_payment_gateways
             (payment_id, gateway, gateway_order_id, payment_session_id, status)
           VALUES (?, ?, ?, ?, 'CREATED')`,
          [paymentId, provider, gatewayOrderId, paymentSessionId]
        );
        await connection2.execute(
          `UPDATE checkout_idempotency_keys
           SET gateway_order_id = ?,
               payment_session_id = ?,
               payment_provider = ?,
               razorpay_order_id = CASE WHEN ? = 'RAZORPAY' THEN ? ELSE razorpay_order_id END
           WHERE user_id = ? AND idempotency_key = ?`,
          [
            gatewayOrderId, paymentSessionId, provider, provider,
            provider === 'RAZORPAY' ? gatewayOrderId : null,
            user.id, input.idempotencyKey,
          ]
        );
        await connection2.commit();
      } catch (error) {
        await connection2.rollback();
        throw error;
      } finally {
        connection2.release();
      }

      return NextResponse.json(response);
    } catch (error) {
      await compensateFailedGatewayCreate(orderId);
      console.error(`${provider} order creation failed:`, error);
      return jsonError(
        provider === 'CASHFREE'
          ? 'Unable to start Cashfree checkout. Check sandbox credentials and configuration.'
          : provider === 'RAZORPAY'
            ? 'Unable to start Razorpay checkout. Check the configured API credentials and try again.'
            : 'Unable to start payment right now. Your reserved stock has been released; please try again.',
        502
      );
    }
  } catch (error) {
    console.error('[POST /api/checkout/create-order] Checkout failed:', error);
    return jsonError('Unable to prepare checkout. Please refresh your cart and try again.', 500);
  }
}

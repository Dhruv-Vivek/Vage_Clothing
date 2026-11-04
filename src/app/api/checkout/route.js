import { getPool } from '@/lib/db';
import { userRoute } from '@/lib/api';
import { loadCart } from '@/lib/cart';
import { resolveDelivery } from '@/lib/shipping';
import { stampLatestHistory } from '@/lib/orders';
import { HttpError, cleanText, readJson, toId, withTransaction } from '@/lib/validate';
import { PAYMENT_METHOD_LABELS } from '@/lib/order-status';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * When two customers check out at the same instant MySQL may abort one transaction as a deadlock victim.
 * place_order rolls back completely in that case, so it is safe to simply run it again; the retry then
 * sees the true stock level and reports "out of stock" if the other customer got the last unit.
 */
async function callWithDeadlockRetry(fn, attempts = 3) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (error?.code !== 'ER_LOCK_DEADLOCK' || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 40 * attempt));
    }
  }
}

/** The procedure's messages are written for developers; show customers something kinder. */
function friendlyCheckoutError(error) {
  const message = String(error?.sqlMessage || '');
  if (error?.sqlState !== '45000') return error;
  if (/insufficient stock/i.test(message)) {
    return new HttpError(409, 'Sorry, one of your items just sold out. Please review your cart.');
  }
  if (/address does not belong/i.test(message)) {
    return new HttpError(400, 'That delivery address is not valid. Please choose another one.');
  }
  if (/inactive product/i.test(message)) {
    return new HttpError(409, 'An item in your cart is no longer available. Please review your cart.');
  }
  return error; // coupon and cart messages are already clear
}

/**
 * Place the order. The browser sends only WHICH address, delivery option, coupon and payment method.
 * Prices, discount, shipping and stock all come from MySQL: the place_order stored procedure builds the
 * order from the customer's database cart in one transaction (order, items, stock, coupon, payment).
 */
export const POST = userRoute(async ({ request, user }) => {
  const body = await readJson(request);
  const addressId = toId(body.addressId, 'Delivery address');
  const delivery = resolveDelivery(body.deliveryOption, user.membership);
  const couponCode = cleanText(body.couponCode, { label: 'Coupon code', max: 40 });
  const paymentMethod = String(body.paymentMethod || 'COD');

  if (paymentMethod !== 'COD') {
    throw new HttpError(400, 'Online payment is not available yet. Please choose Cash on delivery.');
  }

  const cart = await loadCart(user.id);
  if (cart.items.length === 0) throw new HttpError(400, 'Your cart is empty.');
  if (cart.hasIssues) {
    throw new HttpError(409, 'Some items in your cart are unavailable or low in stock. Please review your cart.');
  }

  let resultSets;
  try {
    [resultSets] = await callWithDeadlockRetry(() => getPool().execute('CALL place_order(?, ?, ?, ?, ?)', [
    user.id,
    addressId,
    couponCode ? couponCode.toUpperCase() : null,
    delivery.amount,
    paymentMethod,
    ]));
  } catch (error) {
    throw friendlyCheckoutError(error);
  }
  const placed = resultSets?.[0]?.[0];
  if (!placed) throw new Error('place_order returned no order');
  const orderId = Number(placed.order_id);

  // Record how it will ship and how it will be paid on the order's first history entry.
  await withTransaction((connection) =>
    stampLatestHistory(
      connection,
      orderId,
      user.id,
      `Order placed: ${delivery.name} (${delivery.days}), ${PAYMENT_METHOD_LABELS[paymentMethod]}`
    )
  );

  return NextResponse.json(
    {
      orderId,
      orderNumber: placed.order_number,
      subtotal: Number(placed.subtotal),
      discountAmount: Number(placed.discount_amount),
      shippingAmount: Number(placed.shipping_amount),
      totalAmount: Number(placed.total_amount),
    },
    { status: 201 }
  );
});

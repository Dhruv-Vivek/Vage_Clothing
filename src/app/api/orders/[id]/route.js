import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request, context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const rawId = (await context.params).id;
  if (!/^\d+$/.test(String(rawId))) {
    return NextResponse.json({ error: 'Invalid order ID.' }, { status: 400 });
  }
  const orderId = Number(rawId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: 'Invalid order ID.' }, { status: 400 });
  }

  try {
    const orders = await query(
      `SELECT
          o.order_id, o.order_number, o.status, o.payment_status,
          o.subtotal, o.discount_amount, o.coupon_discount_amount,
          o.membership_discount_amount, o.shipping_amount,
          o.delivery_method, o.total_amount, o.created_at,
          a.recipient_name, a.phone, a.address_line1, a.address_line2,
          a.city, a.state_name, a.postal_code, a.country,
          p.transaction_ref, p.paid_at, p.payment_method, g.gateway AS payment_provider, g.gateway_payment_id
       FROM orders o
       LEFT JOIN addresses a ON a.address_id = o.address_id
       LEFT JOIN payments p ON p.order_id = o.order_id AND p.status = 'SUCCESS'
       LEFT JOIN order_payment_gateways g ON g.payment_id = p.payment_id
       WHERE o.order_id = ? AND o.user_id = ?
       ORDER BY p.paid_at DESC
       LIMIT 1`,
      [orderId, user.id]
    );

    if (!orders.length) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

    const items = await query(
      `SELECT product_name, sku, size, color, unit_price, quantity, line_total
       FROM order_items
       WHERE order_id = ?
       ORDER BY order_item_id`,
      [orderId]
    );

    const emailDelivery = await query(
      `SELECT event_type, status, provider_message_id, last_error, sent_at
       FROM email_outbox
       WHERE dedupe_key IN (?, ?)
       ORDER BY email_outbox_id`,
      [`order-confirmation/${orderId}`, `payment-receipt/${orderId}`]
    );

    return NextResponse.json(
      { order: orders[0], items, emailDelivery },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('[GET /api/orders/:id] Failed:', error);
    return NextResponse.json({ error: 'Unable to load this order.' }, { status: 500 });
  }
}

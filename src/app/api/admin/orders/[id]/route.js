import { adminRoute, HttpError, cleanText, readJson, toId } from '@/lib/admin';
import { adminAdvanceOrder } from '@/lib/order-lifecycle';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = adminRoute(async ({ params }) => {
  const orderId = toId(params.id, 'Order');
  const rows = await query(
    `SELECT o.*, u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
            a.recipient_name, a.phone AS address_phone, a.address_line1, a.address_line2,
            a.city, a.state_name, a.postal_code, a.country,
            cp.coupon_code, p.payment_method, p.status AS payment_record_status,
            p.amount AS payment_amount, p.transaction_ref, p.paid_at,
            g.gateway AS payment_provider, g.gateway_order_id, g.gateway_payment_id
       FROM orders o
       INNER JOIN users u ON u.user_id = o.user_id
       LEFT JOIN addresses a ON a.address_id = o.address_id
       LEFT JOIN coupons cp ON cp.coupon_id = o.coupon_id
       LEFT JOIN payments p ON p.payment_id = (
         SELECT MAX(p2.payment_id) FROM payments p2 WHERE p2.order_id = o.order_id
       )
       LEFT JOIN order_payment_gateways g ON g.payment_id = p.payment_id
      WHERE o.order_id = ? LIMIT 1`,
    [orderId]
  );
  if (!rows.length) throw new HttpError(404, 'Order not found.');
  const row = rows[0];
  const [items, history] = await Promise.all([
    query(
      `SELECT oi.order_item_id, oi.product_name, oi.sku, oi.size, oi.color,
              oi.unit_price, oi.quantity, oi.line_total, p.image_url
         FROM order_items oi
         LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
         LEFT JOIN products p ON p.product_id = pv.product_id
        WHERE oi.order_id = ? ORDER BY oi.order_item_id`,
      [orderId]
    ),
    query(
      `SELECT h.history_id, h.old_status, h.new_status, h.note, h.changed_at,
              u.full_name AS changed_by_name
         FROM order_status_history h
         LEFT JOIN users u ON u.user_id = h.changed_by
        WHERE h.order_id = ? ORDER BY h.history_id`,
      [orderId]
    ),
  ]);
  const nextStatuses = {
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED'],
  }[row.status] || [];
  return {
    order: {
      id: Number(row.order_id), orderNumber: row.order_number, status: row.status,
      paymentStatus: row.payment_status, subtotal: Number(row.subtotal),
      discountAmount: Number(row.discount_amount), shippingAmount: Number(row.shipping_amount),
      totalAmount: Number(row.total_amount), couponCode: row.coupon_code || null,
      createdAt: row.created_at,
    },
    customer: { id: Number(row.user_id), name: row.customer_name, email: row.customer_email, phone: row.customer_phone || null },
    address: row.recipient_name ? {
      recipientName: row.recipient_name, phone: row.address_phone, line1: row.address_line1,
      line2: row.address_line2 || '', city: row.city, state: row.state_name,
      postalCode: row.postal_code, country: row.country,
    } : null,
    items: items.map((item) => ({
      id: Number(item.order_item_id), productName: item.product_name, sku: item.sku,
      size: item.size, color: item.color, unitPrice: Number(item.unit_price),
      quantity: Number(item.quantity), lineTotal: Number(item.line_total), imageUrl: item.image_url || null,
    })),
    payments: row.payment_method ? [{
      method: row.payment_method, status: row.payment_record_status,
      amount: Number(row.payment_amount), transactionRef: row.transaction_ref || row.gateway_payment_id || null,
      paidAt: row.paid_at,
    }] : [],
    history: history.map((item) => ({
      id: Number(item.history_id), oldStatus: item.old_status, newStatus: item.new_status,
      note: item.note || '', changedAt: item.changed_at, changedBy: item.changed_by_name || null,
    })),
    nextStatuses,
  };
});

export const PATCH = adminRoute(async ({ request, params, user }) => {
  const orderId = toId(params.id, 'Order');
  const body = await readJson(request);
  const nextStatus = String(body.nextStatus || body.status || '').trim().toUpperCase();
  const note = cleanText(body.note, { label: 'Note', max: 500, required: false });
  return adminAdvanceOrder({ orderId, nextStatus, note, actor: user });
});

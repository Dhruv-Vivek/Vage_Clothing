import 'server-only';

import { query } from '@/lib/db';
import { HttpError, run } from '@/lib/admin';

/** Write who/why onto the status-history row that the database trigger just created for this order. */
export async function stampLatestHistory(connection, orderId, actorId, note) {
  await run(
    connection,
    'UPDATE order_status_history SET changed_by = ?, note = ? WHERE order_id = ? ORDER BY history_id DESC LIMIT 1',
    [actorId ?? null, note, orderId]
  );
}

/**
 * Cancel an order inside the caller's transaction: set the status (the trg_order_status_guard trigger
 * rejects illegal moves first), put every item back into stock with an audit entry, give back the
 * coupon use, and stamp the history row. The caller must already hold the order row lock.
 */
export async function cancelOrderInTx(connection, order, { actorId, note }) {
  await run(connection, "UPDATE orders SET status = 'CANCELLED' WHERE order_id = ?", [order.order_id]);

  const items = await run(connection, 'SELECT variant_id, quantity FROM order_items WHERE order_id = ?', [
    order.order_id,
  ]);
  const reason = `Order ${order.order_number} cancelled`;

  for (const item of items) {
    const updated = await run(
      connection,
      'UPDATE inventory SET stock_quantity = stock_quantity + ? WHERE variant_id = ?',
      [item.quantity, item.variant_id]
    );
    if (updated.affectedRows === 1) {
      // The inventory trigger just wrote a STOCK_IN row; relabel it so the log says why.
      await run(
        connection,
        `UPDATE inventory_log SET change_type = 'CANCELLATION', reason = ?, changed_by = ?
          WHERE variant_id = ? ORDER BY log_id DESC LIMIT 1`,
        [reason, actorId ?? null, item.variant_id]
      );
    } else {
      await run(connection, 'INSERT INTO inventory (variant_id, stock_quantity) VALUES (?, ?)', [
        item.variant_id,
        item.quantity,
      ]);
      await run(
        connection,
        `INSERT INTO inventory_log
           (variant_id, change_type, quantity_change, stock_before, stock_after, reason, changed_by)
         VALUES (?, 'CANCELLATION', ?, 0, ?, ?, ?)`,
        [item.variant_id, item.quantity, item.quantity, reason, actorId ?? null]
      );
    }
  }

  if (order.coupon_id) {
    await run(connection, 'UPDATE coupons SET usage_count = GREATEST(usage_count - 1, 0) WHERE coupon_id = ?', [
      order.coupon_id,
    ]);
  }
  await stampLatestHistory(connection, order.order_id, actorId, note);
}

/** Lock one order row (optionally only if it belongs to userId). Throws 404 if it does not exist / is not theirs. */
export async function lockOrder(connection, orderId, userId = null) {
  const rows = await run(
    connection,
    `SELECT order_id, order_number, user_id, status, payment_status, coupon_id
       FROM orders WHERE order_id = ? ${userId ? 'AND user_id = ?' : ''} FOR UPDATE`,
    userId ? [orderId, userId] : [orderId]
  );
  if (!rows.length) throw new HttpError(404, 'Order not found.');
  return rows[0];
}

export async function loadOrderDetail(orderId, { userId = null, admin = false } = {}) {
  const rows = await query(
    `SELECT o.*, cp.coupon_code,
            u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
            a.recipient_name, a.phone AS address_phone, a.address_line1, a.address_line2,
            a.city, a.state_name, a.postal_code, a.country
       FROM orders AS o
       JOIN users AS u ON u.user_id = o.user_id
       LEFT JOIN coupons AS cp ON cp.coupon_id = o.coupon_id
       LEFT JOIN addresses AS a ON a.address_id = o.address_id
      WHERE o.order_id = ? ${userId ? 'AND o.user_id = ?' : ''}
      LIMIT 1`,
    userId ? [orderId, userId] : [orderId]
  );
  if (!rows.length) return null;
  const o = rows[0];

  const [items, payments, history] = await Promise.all([
    query(
      `SELECT oi.*, p.image_url, p.product_id
         FROM order_items AS oi
         LEFT JOIN product_variants AS pv ON pv.variant_id = oi.variant_id
         LEFT JOIN products AS p ON p.product_id = pv.product_id
        WHERE oi.order_id = ? ORDER BY oi.order_item_id`,
      [orderId]
    ),
    query('SELECT * FROM payments WHERE order_id = ? ORDER BY payment_id', [orderId]),
    query(
      `SELECT h.*, u.full_name AS changed_by_name
         FROM order_status_history AS h
         LEFT JOIN users AS u ON u.user_id = h.changed_by
        WHERE h.order_id = ? ORDER BY h.history_id`,
      [orderId]
    ),
  ]);

  const detail = {
    order: {
      id: Number(o.order_id),
      orderNumber: o.order_number,
      status: o.status,
      paymentStatus: o.payment_status,
      subtotal: Number(o.subtotal),
      discountAmount: Number(o.discount_amount),
      shippingAmount: Number(o.shipping_amount),
      totalAmount: Number(o.total_amount),
      couponCode: o.coupon_code || null,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    },
    address: o.recipient_name
      ? {
          recipientName: o.recipient_name,
          phone: o.address_phone,
          line1: o.address_line1,
          line2: o.address_line2 || '',
          city: o.city,
          state: o.state_name,
          postalCode: o.postal_code,
          country: o.country,
        }
      : null,
    items: items.map((i) => ({
      id: Number(i.order_item_id),
      productId: i.product_id ? Number(i.product_id) : null,
      productName: i.product_name,
      sku: i.sku,
      size: i.size,
      color: i.color,
      unitPrice: Number(i.unit_price),
      quantity: Number(i.quantity),
      lineTotal: Number(i.line_total),
      imageUrl: i.image_url || null,
    })),
    payments: payments.map((p) => ({
      id: Number(p.payment_id),
      method: p.payment_method,
      status: p.status,
      amount: Number(p.amount),
      transactionRef: p.transaction_ref || null,
      paidAt: p.paid_at,
    })),
    history: history.map((h) => ({
      id: Number(h.history_id),
      oldStatus: h.old_status,
      newStatus: h.new_status,
      note: h.note || '',
      changedAt: h.changed_at,
      ...(admin ? { changedBy: h.changed_by_name || null } : {}),
    })),
  };

  if (admin) {
    detail.customer = {
      id: Number(o.user_id),
      name: o.customer_name,
      email: o.customer_email,
      phone: o.customer_phone || null,
    };
  }
  return detail;
}

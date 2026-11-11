import 'server-only';

/**
 * EMBEDDED MYSQL: manages order status transitions, stock restoration, returns and payment records using transactional SELECT/UPDATE/INSERT statements; preserves the Razorpay refund service.
 * See backend/README.md for the database/backend walkthrough.
 */

import { getPool } from '@/lib/db';
import { getRazorpay } from '@/lib/razorpay';
import { HttpError, toCents } from '@/lib/guards';
import { enqueueOrderEvent, enqueueReturnEvent } from '@/lib/email-events';
import { dispatchEmailsByDedupeKeys } from '@/lib/order-email';

export const RETURN_WINDOW_DAYS = Math.max(
  1,
  Math.min(30, Number.parseInt(process.env.RETURN_WINDOW_DAYS || '7', 10) || 7)
);

async function noteLastStatusChange(connection, orderId, actorId, note) {
  await connection.execute(
    `UPDATE order_status_history
        SET changed_by = ?, note = ?
      WHERE order_id = ?
      ORDER BY history_id DESC LIMIT 1`,
    [actorId ?? null, String(note || '').slice(0, 500), orderId]
  );
}

async function tagLatestInventoryLog(connection, variantId, { type, reason, actorId }) {
  await connection.execute(
    `UPDATE inventory_log SET change_type = ?, reason = ?, changed_by = ?
      WHERE variant_id = ? ORDER BY log_id DESC LIMIT 1`,
    [type, String(reason || '').slice(0, 255), actorId ?? null, variantId]
  );
}

async function restoreOrderStock(connection, orderId, actorId, type, reason) {
  const [items] = await connection.execute(
    'SELECT variant_id, SUM(quantity) AS quantity FROM order_items WHERE order_id = ? GROUP BY variant_id',
    [orderId]
  );
  for (const item of items) {
    const [result] = await connection.execute(
      'UPDATE inventory SET stock_quantity = stock_quantity + ? WHERE variant_id = ?',
      [Number(item.quantity), Number(item.variant_id)]
    );
    if (result.affectedRows !== 1) {
      throw new Error(`Unable to restore inventory for variant ${Number(item.variant_id)}.`);
    }
    await tagLatestInventoryLog(connection, Number(item.variant_id), { type, reason, actorId });
  }
}

async function refundOnce(paymentId, amountCents, refundKey) {
  const razorpay = getRazorpay();
  const existing = await razorpay.payments.fetchMultipleRefund(paymentId, { count: 100 });
  const prior = (existing.items || []).find((refund) =>
    refund.notes?.vage_refund_key === refundKey && refund.status !== 'failed'
  );
  if (prior) return prior;
  const refund = await razorpay.payments.refund(paymentId, {
    amount: amountCents,
    speed: 'normal',
    receipt: refundKey.slice(0, 40),
    notes: { vage_refund_key: refundKey },
  });
  if (refund.status === 'failed') throw new Error('Razorpay could not issue the refund.');
  return refund;
}

const ORDER_FIELDS = `
  o.order_id, o.order_number, o.user_id, o.status, o.payment_status,
  o.subtotal, o.discount_amount, o.coupon_discount_amount,
  o.membership_discount_amount, o.shipping_amount, o.total_amount,
  o.coupon_id, o.created_at, p.payment_id, p.status AS payment_row_status,
  p.payment_method, p.amount AS payment_amount,
  g.gateway, g.gateway_payment_id, g.gateway_order_id, g.status AS gateway_status
`;

async function lockOrder(connection, orderId, userId = null) {
  const ownerClause = userId === null ? '' : ' AND o.user_id = ?';
  const params = userId === null ? [orderId] : [orderId, userId];
  const [rows] = await connection.execute(
    `SELECT ${ORDER_FIELDS}
       FROM orders o
       LEFT JOIN payments p ON p.payment_id = (
         SELECT MAX(p2.payment_id) FROM payments p2 WHERE p2.order_id = o.order_id
       )
       LEFT JOIN order_payment_gateways g ON g.payment_id = p.payment_id
      WHERE o.order_id = ?${ownerClause}
      LIMIT 1 FOR UPDATE`,
    params
  );
  return rows[0] || null;
}

export async function listAdminOrders({ status = '', limit = 100 } = {}) {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
  const allowed = new Set(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED']);
  const filter = allowed.has(String(status).toUpperCase()) ? String(status).toUpperCase() : '';
  const [rows] = await pool.execute(
    `SELECT o.order_id, o.order_number, o.status, o.payment_status, o.total_amount,
            o.created_at, u.full_name AS customer_name, u.email AS customer_email,
            g.gateway AS payment_provider,
            (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.order_id) AS item_count
       FROM orders o INNER JOIN users u ON u.user_id = o.user_id
       LEFT JOIN payments p ON p.payment_id = (
         SELECT MAX(p2.payment_id) FROM payments p2 WHERE p2.order_id = o.order_id
       )
       LEFT JOIN order_payment_gateways g ON g.payment_id = p.payment_id
      WHERE (? = '' OR o.status = ?)
      ORDER BY o.created_at DESC, o.order_id DESC LIMIT ?`,
    [filter, filter, safeLimit]
  );
  return rows.map((row) => ({
    orderId: Number(row.order_id), orderNumber: row.order_number,
    status: row.status, paymentStatus: row.payment_status,
    totalAmount: Number(row.total_amount), createdAt: row.created_at,
    customerName: row.customer_name, customerEmail: row.customer_email,
    paymentProvider: row.payment_provider || null, itemCount: Number(row.item_count),
  }));
}

export async function listAdminReturns({ status = '', limit = 100 } = {}) {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
  const allowed = new Set(['REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED']);
  const filter = allowed.has(String(status).toUpperCase()) ? String(status).toUpperCase() : '';
  const [rows] = await pool.execute(
    `SELECT r.return_id, r.quantity, r.reason, r.status, r.resolution_notes,
            r.refund_amount, r.refund_reference, r.requested_at,
            oi.order_id, o.order_number, oi.product_name, oi.size, oi.color,
            u.full_name AS customer_name, u.email AS customer_email
       FROM returns r
       INNER JOIN order_items oi ON oi.order_item_id = r.order_item_id
       INNER JOIN orders o ON o.order_id = oi.order_id
       INNER JOIN users u ON u.user_id = o.user_id
      WHERE (? = '' OR r.status = ?)
      ORDER BY r.requested_at DESC, r.return_id DESC LIMIT ?`,
    [filter, filter, safeLimit]
  );
  return rows.map((row) => ({
    returnId: Number(row.return_id), orderId: Number(row.order_id),
    orderNumber: row.order_number, productName: row.product_name,
    size: row.size, color: row.color, quantity: Number(row.quantity),
    reason: row.reason, status: row.status, notes: row.resolution_notes,
    refundAmount: row.refund_amount === null ? null : Number(row.refund_amount),
    refundReference: row.refund_reference, requestedAt: row.requested_at,
    customerName: row.customer_name, customerEmail: row.customer_email,
  }));
}

/** Cancel an order before shipment. Captured Razorpay payments are refunded exactly once. */
export async function cancelOrder({ orderId, userId = null, actor }) {
  const pool = getPool();
  const connection = await pool.getConnection();
  let emailKey = null;
  let refund = null;
  let simulatedRefund = false;

  try {
    await connection.beginTransaction();
    const order = await lockOrder(connection, orderId, userId);
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.status === 'CANCELLED') {
      await connection.commit();
      return { orderId, status: 'CANCELLED', alreadyFinal: true };
    }
    const isCashOnDelivery = String(order.payment_method || '').toUpperCase() === 'COD';
    if (order.status === 'PENDING' && (!isCashOnDelivery || order.payment_status === 'PAID')) {
      throw new HttpError(409, 'The online payment session is still active. Complete or close checkout before cancelling this order.');
    }
    if (!['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)) {
      throw new HttpError(409, 'This order can no longer be cancelled online.');
    }

    const paid = order.payment_status === 'PAID';
    if (paid) {
      if (order.gateway === 'RAZORPAY' && order.gateway_payment_id) {
        try {
          refund = await refundOnce(order.gateway_payment_id, toCents(order.total_amount), `vage-cancel-${orderId}`);
        } catch (error) {
          console.error('[cancelOrder] Razorpay refund failed:', error);
          throw new HttpError(502, 'The refund could not be issued. Your order has not been cancelled; please try again.');
        }
      } else if (order.gateway === 'DEMO') {
        simulatedRefund = true;
      } else {
        throw new HttpError(409, 'This payment provider does not support automatic refunds here. Please contact VAGE support before cancelling.');
      }
    }

    const nextPaymentStatus = paid ? 'REFUNDED' : 'FAILED';
    const [changed] = await connection.execute(
      `UPDATE orders SET status = 'CANCELLED', payment_status = ?
        WHERE order_id = ? AND status IN ('PENDING','CONFIRMED','PROCESSING')`,
      [nextPaymentStatus, orderId]
    );
    if (changed.affectedRows !== 1) {
      throw new HttpError(409, 'The order changed while cancellation was being processed. Refresh and check its status.');
    }

    if (order.payment_id) {
      await connection.execute(
        'UPDATE payments SET status = ? WHERE payment_id = ?',
        [nextPaymentStatus === 'REFUNDED' ? 'REFUNDED' : 'FAILED', order.payment_id]
      );
    }
    if (order.gateway_order_id) {
      await connection.execute(
        'UPDATE order_payment_gateways SET status = ? WHERE gateway_order_id = ? AND gateway = ?',
        [nextPaymentStatus === 'REFUNDED' ? 'REFUNDED' : 'FAILED', order.gateway_order_id, order.gateway]
      );
    }

    await restoreOrderStock(connection, orderId, actor?.id, 'CANCELLATION', `Order ${order.order_number} cancelled`);
    if (order.coupon_id) {
      await connection.execute(
        'UPDATE coupons SET usage_count = GREATEST(usage_count - 1, 0) WHERE coupon_id = ?',
        [order.coupon_id]
      );
    }
    await noteLastStatusChange(connection, orderId, actor?.id, refund
      ? `Customer/admin cancellation; Razorpay refund ${refund.id}`
      : simulatedRefund ? 'Cancellation recorded in demo payment mode' : 'Unpaid order cancelled and reserved stock released');
    emailKey = await enqueueOrderEvent(connection, orderId, 'ORDER_CANCELLED');
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (emailKey) await dispatchEmailsByDedupeKeys([emailKey]).catch(() => undefined);
  return {
    orderId, status: 'CANCELLED', refunded: Boolean(refund || simulatedRefund),
    refundId: refund?.id || null, simulatedRefund,
  };
}

const ADMIN_TRANSITIONS = {
  PENDING: ['CONFIRMED'],
  CONFIRMED: ['PROCESSING'],
  PROCESSING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
};

export async function adminAdvanceOrder({ orderId, nextStatus, note, actor }) {
  if (nextStatus === 'CANCELLED') return cancelOrder({ orderId, actor });
  const connection = await getPool().getConnection();
  let emailKey = null;
  try {
    await connection.beginTransaction();
    const order = await lockOrder(connection, orderId);
    if (!order) throw new HttpError(404, 'Order not found.');
    if (!(ADMIN_TRANSITIONS[order.status] || []).includes(nextStatus)) {
      throw new HttpError(409, `An order that is ${order.status} cannot be moved to ${nextStatus}.`);
    }
    const isCashOnDelivery = String(order.payment_method || '').toUpperCase() === 'COD';
    if (order.payment_status !== 'PAID' && !isCashOnDelivery) {
      throw new HttpError(409, 'Online orders must be paid before fulfilment. COD orders can move through fulfilment before payment is collected.');
    }
    await connection.execute('UPDATE orders SET status = ? WHERE order_id = ?', [nextStatus, orderId]);
    await noteLastStatusChange(connection, orderId, actor?.id, note || `Order moved to ${nextStatus}`);
    if (nextStatus === 'SHIPPED' || nextStatus === 'DELIVERED') {
      emailKey = await enqueueOrderEvent(connection, orderId, nextStatus === 'SHIPPED' ? 'ORDER_SHIPPED' : 'ORDER_DELIVERED');
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  if (emailKey) await dispatchEmailsByDedupeKeys([emailKey]).catch(() => undefined);
  return { orderId, status: nextStatus };
}

export async function createReturnRequest({ userId, orderId, orderItemId, quantity, reason }) {
  const connection = await getPool().getConnection();
  let returnId;
  let emailKey;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT oi.quantity AS purchased, o.status,
              COALESCE((SELECT SUM(r.quantity) FROM returns r
                         WHERE r.order_item_id = oi.order_item_id AND r.status <> 'REJECTED'), 0) AS already_requested,
              (SELECT (NOW() <= DATE_ADD(MAX(h.changed_at), INTERVAL ? DAY))
                 FROM order_status_history h
                WHERE h.order_id = o.order_id AND h.new_status = 'DELIVERED') AS window_open
         FROM order_items oi INNER JOIN orders o ON o.order_id = oi.order_id
        WHERE oi.order_item_id = ? AND o.order_id = ? AND o.user_id = ?
        FOR UPDATE`,
      [RETURN_WINDOW_DAYS, orderItemId, orderId, userId]
    );
    if (!rows.length) throw new HttpError(404, 'That order item was not found.');
    const row = rows[0];
    if (row.status !== 'DELIVERED') throw new HttpError(409, 'Returns can only be requested after delivery.');
    if (!row.window_open) throw new HttpError(409, `The ${RETURN_WINDOW_DAYS}-day return window has closed.`);
    const available = Number(row.purchased) - Number(row.already_requested);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > available) {
      throw new HttpError(422, available > 0 ? `You can return at most ${available} of this item.` : 'A return was already requested for every unit.');
    }
    const [insert] = await connection.execute(
      `INSERT INTO returns (order_item_id, quantity, reason, status)
       VALUES (?, ?, ?, 'REQUESTED')`,
      [orderItemId, quantity, reason]
    );
    returnId = Number(insert.insertId);
    emailKey = await enqueueReturnEvent(connection, { returnId, orderId, status: 'REQUESTED' });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  if (emailKey) await dispatchEmailsByDedupeKeys([emailKey]).catch(() => undefined);
  return { returnId };
}

const RETURN_TRANSITIONS = {
  REQUESTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['RECEIVED'],
  RECEIVED: ['REFUNDED'],
};

/** Admin-only return processing. Refunds use a deterministic Razorpay note key for retry safety. */
export async function adminUpdateReturn({ returnId, nextStatus, notes, actor }) {
  if (!Object.values(RETURN_TRANSITIONS).flat().includes(nextStatus)) {
    throw new HttpError(422, 'Choose a valid return status.');
  }
  const connection = await getPool().getConnection();
  let emailKey = null;
  let refund = null;
  let refundCents = null;
  let orderId;

  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT r.return_id, r.status, r.quantity, r.order_item_id, oi.order_id,
              oi.variant_id, oi.unit_price, o.subtotal, o.discount_amount,
              o.status AS order_status, o.payment_status,
              p.payment_id, g.gateway, g.gateway_payment_id
         FROM returns r INNER JOIN order_items oi ON oi.order_item_id = r.order_item_id
         INNER JOIN orders o ON o.order_id = oi.order_id
         LEFT JOIN payments p ON p.payment_id = (
           SELECT MAX(p2.payment_id) FROM payments p2 WHERE p2.order_id = o.order_id
         )
         LEFT JOIN order_payment_gateways g ON g.payment_id = p.payment_id
        WHERE r.return_id = ? LIMIT 1 FOR UPDATE`,
      [returnId]
    );
    if (!rows.length) throw new HttpError(404, 'Return not found.');
    const ret = rows[0];
    orderId = Number(ret.order_id);
    if (!(RETURN_TRANSITIONS[ret.status] || []).includes(nextStatus)) {
      throw new HttpError(409, `A return that is ${ret.status} cannot be moved to ${nextStatus}.`);
    }
    if (nextStatus === 'REJECTED' && !String(notes || '').trim()) {
      throw new HttpError(422, 'Add a short note explaining why this return was rejected.');
    }

    if (nextStatus === 'RECEIVED') {
      const [result] = await connection.execute(
        'UPDATE inventory SET stock_quantity = stock_quantity + ? WHERE variant_id = ?',
        [Number(ret.quantity), Number(ret.variant_id)]
      );
      if (result.affectedRows !== 1) throw new Error('Unable to restock the returned product.');
      await tagLatestInventoryLog(connection, Number(ret.variant_id), {
        type: 'RETURN', reason: `Return ${returnId} received`, actorId: actor?.id,
      });
    }

    if (nextStatus === 'REFUNDED') {
      if (ret.payment_status !== 'PAID' || ret.gateway !== 'RAZORPAY' || !ret.gateway_payment_id) {
        throw new HttpError(409, 'This order does not have a captured Razorpay payment that can be refunded automatically.');
      }
      const grossCents = toCents(ret.unit_price) * Number(ret.quantity);
      const subtotalCents = toCents(ret.subtotal);
      const allocatedDiscount = subtotalCents > 0
        ? Math.min(grossCents, Math.round(toCents(ret.discount_amount) * grossCents / subtotalCents))
        : 0;
      refundCents = grossCents - allocatedDiscount;
      if (refundCents <= 0) throw new HttpError(409, 'The refundable amount for this return is zero.');
      try {
        refund = await refundOnce(ret.gateway_payment_id, refundCents, `vage-return-${returnId}`);
      } catch (error) {
        console.error('[adminUpdateReturn] Razorpay refund failed:', error);
        throw new HttpError(502, 'The refund could not be issued. The return status has not been changed.');
      }
    }

    const savedNotes = [String(notes || '').trim(), refund ? `Razorpay refund ${refund.id}` : ''].filter(Boolean).join(' | ');
    await connection.execute(
      `UPDATE returns
          SET status = ?, resolution_notes = COALESCE(NULLIF(?, ''), resolution_notes),
              refund_amount = ?, refund_reference = ?
        WHERE return_id = ?`,
      [nextStatus, savedNotes.slice(0, 2000), refundCents === null ? null : refundCents / 100, refund?.id || null, returnId]
    );

    if (nextStatus === 'REFUNDED') {
      const [[summary]] = await connection.execute(
        `SELECT COUNT(*) AS outstanding
           FROM order_items oi
          WHERE oi.order_id = ?
            AND oi.quantity > COALESCE((
              SELECT SUM(r.quantity) FROM returns r
               WHERE r.order_item_id = oi.order_item_id AND r.status = 'REFUNDED'
            ), 0)`,
        [orderId]
      );
      if (Number(summary.outstanding) === 0) {
        await connection.execute(
          `UPDATE orders SET status = 'RETURNED', payment_status = 'REFUNDED'
            WHERE order_id = ? AND status = 'DELIVERED'`,
          [orderId]
        );
        await connection.execute(
          "UPDATE payments SET status = 'REFUNDED' WHERE payment_id = ?",
          [ret.payment_id]
        );
        await connection.execute(
          "UPDATE order_payment_gateways SET status = 'REFUNDED' WHERE payment_id = ?",
          [ret.payment_id]
        );
        await noteLastStatusChange(connection, orderId, actor?.id, 'All ordered quantities have been returned and refunded');
      }
    }

    emailKey = await enqueueReturnEvent(connection, { returnId, orderId, status: nextStatus });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  if (emailKey) await dispatchEmailsByDedupeKeys([emailKey]).catch(() => undefined);
  return { returnId, status: nextStatus, refundId: refund?.id || null, refundAmount: refundCents === null ? null : refundCents / 100 };
}

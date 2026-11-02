import 'server-only';

import { getPool } from '@/lib/db';
import { enqueuePaidOrderEmails, dispatchPaidOrderEmails } from '@/lib/order-email';

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

export async function markRazorpayPaymentCaptured({
  gatewayOrderId,
  gatewayPaymentId,
  amount,
  currency,
  signatureVerified,
}) {
  const pool = getPool();
  const connection = await pool.getConnection();

  let orderId;
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT
          o.order_id, o.order_number, o.user_id, o.status AS order_status,
          o.payment_status, o.total_amount, p.payment_id, p.amount AS payment_amount,
          p.status AS payment_row_status, u.email,
          g.gateway_order_id, g.gateway_payment_id
       FROM order_payment_gateways g
       INNER JOIN payments p ON p.payment_id = g.payment_id
       INNER JOIN orders o ON o.order_id = p.order_id
       INNER JOIN users u ON u.user_id = o.user_id
       WHERE g.gateway_order_id = ?
       LIMIT 1
       FOR UPDATE`,
      [gatewayOrderId]
    );

    if (!rows.length) throw new Error('Razorpay order is not linked to a VAGE order.');
    const row = rows[0];
    orderId = Number(row.order_id);

    if (row.gateway_payment_id && row.gateway_payment_id !== gatewayPaymentId) {
      throw new Error('A different Razorpay payment is already linked to this order.');
    }

    const expectedCents = toCents(row.payment_amount);
    if (Number(amount) !== expectedCents || currency !== 'INR') {
      throw new Error('Captured payment amount or currency does not match the VAGE order.');
    }

    if (row.payment_status !== 'PAID') {
      if (row.order_status === 'CANCELLED' || row.order_status === 'RETURNED') {
        throw new Error('This order is cancelled and cannot be fulfilled.');
      }

      await connection.execute(
        `UPDATE payments
         SET status = 'SUCCESS', transaction_ref = ?, paid_at = NOW()
         WHERE payment_id = ?`,
        [gatewayPaymentId, row.payment_id]
      );
      await connection.execute(
        `UPDATE order_payment_gateways
         SET gateway_payment_id = ?, status = 'CAPTURED', signature_verified = ?
         WHERE gateway_order_id = ?`,
        [gatewayPaymentId, signatureVerified ? 1 : 0, gatewayOrderId]
      );
      await connection.execute(
        `UPDATE orders SET status = 'CONFIRMED', payment_status = 'PAID' WHERE order_id = ?`,
        [orderId]
      );

      await enqueuePaidOrderEmails(connection, {
        order_id: orderId,
        order_number: row.order_number,
        email: row.email,
      });
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  // Email failure must never undo a captured payment or fail the checkout.
  const emailResults = await dispatchPaidOrderEmails(orderId).catch((error) => [{
    status: 'FAILED',
    error: String(error?.message || 'Unable to dispatch order emails.'),
  }]);

  return { orderId, paymentStatus: 'PAID', emailResults };
}


export async function markRazorpayPaymentAuthorized({ gatewayOrderId, gatewayPaymentId }) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT o.order_id, o.status AS order_status, o.payment_status,
              g.gateway_payment_id
       FROM order_payment_gateways g
       INNER JOIN payments p ON p.payment_id = g.payment_id
       INNER JOIN orders o ON o.order_id = p.order_id
       WHERE g.gateway_order_id = ?
       LIMIT 1
       FOR UPDATE`,
      [gatewayOrderId]
    );

    if (!rows.length) throw new Error('Razorpay order is not linked to a VAGE order.');
    const row = rows[0];

    if (row.payment_status === 'PAID') {
      await connection.commit();
      return { paymentStatus: 'PAID', alreadyFinal: true };
    }
    if (row.order_status === 'CANCELLED' || row.order_status === 'RETURNED') {
      throw new Error('This order is no longer active.');
    }
    if (row.gateway_payment_id && row.gateway_payment_id !== gatewayPaymentId) {
      throw new Error('A different Razorpay payment is already associated with this order.');
    }

    await connection.execute(
      `UPDATE order_payment_gateways
       SET gateway_payment_id = ?, status = 'AUTHORIZED'
       WHERE gateway_order_id = ? AND status <> 'CAPTURED'`,
      [gatewayPaymentId, gatewayOrderId]
    );

    await connection.commit();
    return { paymentStatus: 'PENDING', gatewayStatus: 'AUTHORIZED' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function markRazorpayPaymentFailed({ gatewayOrderId, gatewayPaymentId }) {
  const pool = getPool();
  const connection = await pool.getConnection();
  let orderId;

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT o.order_id, o.status AS order_status, o.payment_status,
              p.payment_id, g.gateway_order_id
       FROM order_payment_gateways g
       INNER JOIN payments p ON p.payment_id = g.payment_id
       INNER JOIN orders o ON o.order_id = p.order_id
       WHERE g.gateway_order_id = ?
       LIMIT 1
       FOR UPDATE`,
      [gatewayOrderId]
    );

    if (!rows.length) throw new Error('Razorpay order is not linked to a VAGE order.');
    const row = rows[0];
    orderId = Number(row.order_id);

    if (row.payment_status === 'PAID' || row.order_status === 'CANCELLED') {
      await connection.commit();
      return { orderId, paymentStatus: row.payment_status, alreadyFinal: true };
    }

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
       WHERE payment_id = ? AND status <> 'SUCCESS'`,
      [row.payment_id]
    );
    await connection.execute(
      `UPDATE order_payment_gateways
       SET gateway_payment_id = COALESCE(gateway_payment_id, ?), status = 'FAILED'
       WHERE gateway_order_id = ? AND status <> 'CAPTURED'`,
      [gatewayPaymentId || null, gatewayOrderId]
    );
    await connection.execute(
      `UPDATE orders
       SET status = 'CANCELLED', payment_status = 'FAILED'
       WHERE order_id = ? AND payment_status <> 'PAID'`,
      [orderId]
    );

    await connection.commit();
    return { orderId, paymentStatus: 'FAILED', stockReleased: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

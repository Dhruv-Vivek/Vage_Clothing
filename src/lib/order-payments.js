import 'server-only';

import { getPool } from '@/lib/db';
import { enqueuePaidOrderEmails, dispatchPaidOrderEmails } from '@/lib/order-email';

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

/**
 * Provider-neutral payment capture finalisation.
 * The gateway status and amount must be verified by the caller before this
 * function is invoked. All providers share the same MySQL/order/email path.
 */
export async function markGatewayPaymentCaptured({
  gateway,
  gatewayOrderId,
  gatewayPaymentId,
  amount,
  currency,
  signatureVerified = false,
  dispatchEmails = true,
  queueEmails = true,
}) {
  const provider = String(gateway || '').trim().toUpperCase();
  if (!['RAZORPAY', 'CASHFREE', 'DEMO'].includes(provider)) {
    throw new Error('Unsupported payment provider.');
  }
  if (!gatewayOrderId || !gatewayPaymentId) {
    throw new Error('A gateway order and payment reference are required.');
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  let orderId;

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT
          o.order_id, o.order_number, o.user_id, o.status AS order_status,
          o.payment_status, o.total_amount, p.payment_id, p.amount AS payment_amount,
          p.status AS payment_row_status,
          COALESCE(NULLIF(o.contact_email, ''), u.email) AS email,
          g.gateway, g.gateway_order_id, g.gateway_payment_id
       FROM order_payment_gateways g
       INNER JOIN payments p ON p.payment_id = g.payment_id
       INNER JOIN orders o ON o.order_id = p.order_id
       INNER JOIN users u ON u.user_id = o.user_id
       WHERE g.gateway_order_id = ?
       LIMIT 1
       FOR UPDATE`,
      [gatewayOrderId]
    );

    if (!rows.length || rows[0].gateway !== provider) {
      throw new Error('Payment reference is not linked to the expected VAGE provider/order.');
    }

    const row = rows[0];
    orderId = Number(row.order_id);

    if (row.gateway_payment_id && String(row.gateway_payment_id) !== String(gatewayPaymentId)) {
      throw new Error('A different payment transaction is already associated with this order.');
    }

    if (Number(amount) !== toCents(row.payment_amount) || String(currency).toUpperCase() !== 'INR') {
      throw new Error('Captured payment amount or currency does not match the VAGE order.');
    }

    if (row.payment_status !== 'PAID') {
      if (row.order_status === 'CANCELLED' || row.order_status === 'RETURNED') {
        throw new Error('This order is cancelled and cannot be fulfilled.');
      }

      await connection.execute(
        `UPDATE payments
         SET status = 'SUCCESS', transaction_ref = ?, paid_at = NOW()
         WHERE payment_id = ? AND status <> 'SUCCESS'`,
        [String(gatewayPaymentId), row.payment_id]
      );
      await connection.execute(
        `UPDATE order_payment_gateways
         SET gateway_payment_id = ?, status = 'CAPTURED', signature_verified = ?
         WHERE gateway_order_id = ? AND gateway = ?`,
        [String(gatewayPaymentId), signatureVerified ? 1 : 0, gatewayOrderId, provider]
      );
      await connection.execute(
        `UPDATE orders SET status = 'CONFIRMED', payment_status = 'PAID' WHERE order_id = ?`,
        [orderId]
      );

      if (queueEmails) {
        await enqueuePaidOrderEmails(connection, {
          order_id: orderId,
          order_number: row.order_number,
          email: row.email,
        });
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const emailResults = !queueEmails
    ? []
    : dispatchEmails
      ? await dispatchPaidOrderEmails(orderId).catch((error) => [{
          status: 'FAILED',
          error: String(error?.message || 'Unable to dispatch order emails.'),
        }])
      : [{ status: 'QUEUED' }];

  return { orderId, paymentStatus: 'PAID', emailResults };
}

export async function markGatewayPaymentAuthorized({ gateway, gatewayOrderId, gatewayPaymentId }) {
  const provider = String(gateway || '').trim().toUpperCase();
  if (!['RAZORPAY', 'CASHFREE'].includes(provider)) {
    throw new Error('Unsupported payment provider for authorization.');
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT o.order_id, o.status AS order_status, o.payment_status,
              g.gateway, g.gateway_payment_id
       FROM order_payment_gateways g
       INNER JOIN payments p ON p.payment_id = g.payment_id
       INNER JOIN orders o ON o.order_id = p.order_id
       WHERE g.gateway_order_id = ?
       LIMIT 1
       FOR UPDATE`,
      [gatewayOrderId]
    );

    if (!rows.length || rows[0].gateway !== provider) {
      throw new Error('Payment reference is not linked to the expected VAGE provider/order.');
    }
    const row = rows[0];

    if (row.payment_status === 'PAID') {
      await connection.commit();
      return { paymentStatus: 'PAID', alreadyFinal: true };
    }
    if (row.order_status === 'CANCELLED' || row.order_status === 'RETURNED') {
      throw new Error('This order is no longer active.');
    }
    if (row.gateway_payment_id && String(row.gateway_payment_id) !== String(gatewayPaymentId)) {
      throw new Error('A different payment transaction is already associated with this order.');
    }

    await connection.execute(
      `UPDATE order_payment_gateways
       SET gateway_payment_id = ?, status = 'AUTHORIZED'
       WHERE gateway_order_id = ? AND gateway = ? AND status <> 'CAPTURED'`,
      [String(gatewayPaymentId), gatewayOrderId, provider]
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

export async function markGatewayPaymentPending({ gateway, gatewayOrderId }) {
  const provider = String(gateway || '').trim().toUpperCase();
  if (!['CASHFREE', 'DEMO'].includes(provider)) {
    throw new Error('Unsupported payment provider for pending status.');
  }

  const pool = getPool();
  const [result] = await pool.execute(
    `UPDATE order_payment_gateways g
     INNER JOIN payments p ON p.payment_id = g.payment_id
     INNER JOIN orders o ON o.order_id = p.order_id
     SET g.status = 'PENDING'
     WHERE g.gateway_order_id = ? AND g.gateway = ?
       AND o.status = 'PENDING' AND o.payment_status = 'PENDING'
       AND g.status NOT IN ('CAPTURED','FAILED','REFUNDED')`,
    [gatewayOrderId, provider]
  );
  return { updated: result.affectedRows > 0, paymentStatus: 'PENDING' };
}

/**
 * Final failure/abandonment path. Row locks and the order status guard ensure
 * reserved inventory and coupon usage are released at most once.
 */
export async function markGatewayPaymentFailed({ gateway, gatewayOrderId, gatewayPaymentId }) {
  const provider = String(gateway || '').trim().toUpperCase();
  if (!['RAZORPAY', 'CASHFREE', 'DEMO'].includes(provider)) {
    throw new Error('Unsupported payment provider.');
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT o.order_id, o.status AS order_status, o.payment_status,
              o.coupon_id, p.payment_id, g.gateway_order_id, g.gateway
       FROM order_payment_gateways g
       INNER JOIN payments p ON p.payment_id = g.payment_id
       INNER JOIN orders o ON o.order_id = p.order_id
       WHERE g.gateway_order_id = ?
       LIMIT 1
       FOR UPDATE`,
      [gatewayOrderId]
    );

    if (!rows.length || rows[0].gateway !== provider) {
      throw new Error('Payment reference is not linked to the expected VAGE provider/order.');
    }

    const row = rows[0];
    const orderId = Number(row.order_id);

    if (row.payment_status === 'PAID') {
      await connection.commit();
      return { orderId, paymentStatus: 'PAID', alreadyFinal: true, stockReleased: false };
    }

    if (row.order_status === 'CANCELLED') {
      await connection.commit();
      return {
        orderId,
        paymentStatus: row.payment_status,
        alreadyFinal: true,
        stockReleased: false,
      };
    }

    // The conditional state transition is the idempotency gate for inventory
    // restoration. Only the transaction that moves PENDING -> CANCELLED may
    // return stock and coupon usage. A duplicate failure callback cannot add
    // the same quantity twice.
    const [cancelResult] = await connection.execute(
      `UPDATE orders
       SET status = 'CANCELLED', payment_status = 'FAILED'
       WHERE order_id = ? AND status = 'PENDING' AND payment_status = 'PENDING'`,
      [orderId]
    );

    if (cancelResult.affectedRows !== 1) {
      const [latest] = await connection.execute(
        'SELECT status, payment_status FROM orders WHERE order_id = ? LIMIT 1',
        [orderId]
      );
      await connection.commit();
      return {
        orderId,
        paymentStatus: latest[0]?.payment_status || row.payment_status,
        alreadyFinal: true,
        stockReleased: false,
      };
    }

    await connection.execute(
      `UPDATE payments
       SET status = 'FAILED'
       WHERE payment_id = ? AND status <> 'SUCCESS'`,
      [row.payment_id]
    );

    await connection.execute(
      `UPDATE order_payment_gateways
       SET gateway_payment_id = COALESCE(gateway_payment_id, ?), status = 'FAILED'
       WHERE gateway_order_id = ? AND gateway = ? AND status <> 'CAPTURED'`,
      [gatewayPaymentId ? String(gatewayPaymentId) : null, gatewayOrderId, provider]
    );

    const [items] = await connection.execute(
      'SELECT variant_id, quantity FROM order_items WHERE order_id = ?',
      [orderId]
    );

    for (const item of items) {
      const [restore] = await connection.execute(
        'UPDATE inventory SET stock_quantity = stock_quantity + ? WHERE variant_id = ?',
        [Number(item.quantity), Number(item.variant_id)]
      );

      if (restore.affectedRows !== 1) {
        throw new Error(
          `Unable to restore reserved stock for variant ${Number(item.variant_id)}. The payment failure transaction was rolled back.`
        );
      }
    }

    if (row.coupon_id) {
      await connection.execute(
        'UPDATE coupons SET usage_count = GREATEST(usage_count - 1, 0) WHERE coupon_id = ?',
        [row.coupon_id]
      );
    }

    await connection.commit();
    return { orderId, paymentStatus: 'FAILED', stockReleased: true, restoredLines: items.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Backward-compatible Razorpay exports for the existing webhook and cron code.
export function markRazorpayPaymentCaptured(args) {
  return markGatewayPaymentCaptured({ ...args, gateway: 'RAZORPAY' });
}

export function markRazorpayPaymentAuthorized(args) {
  return markGatewayPaymentAuthorized({ ...args, gateway: 'RAZORPAY' });
}

export function markRazorpayPaymentFailed(args) {
  return markGatewayPaymentFailed({ ...args, gateway: 'RAZORPAY' });
}

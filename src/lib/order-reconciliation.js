import 'server-only';

import { getPool } from '@/lib/db';
import { getRazorpay } from '@/lib/razorpay';
import {
  markRazorpayPaymentCaptured,
  markRazorpayPaymentFailed,
} from '@/lib/order-payments';

/**
 * Reconcile very old pending checkouts against Razorpay before releasing stock.
 * Authorised payments remain reserved; captured payments are finalised.
 * Only orders older than 24 hours with no live/authorised payment are cancelled.
 */
export async function reconcilePendingCheckouts(limit = 10) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT o.order_id, o.order_number, g.gateway_order_id
     FROM orders o
     INNER JOIN payments p ON p.order_id = o.order_id
     INNER JOIN order_payment_gateways g ON g.payment_id = p.payment_id
     WHERE o.status = 'PENDING'
       AND o.payment_status = 'PENDING'
       AND p.status = 'PENDING'
       AND g.status <> 'CAPTURED'
       AND o.created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
     ORDER BY o.created_at
     LIMIT ?`,
    [Math.max(1, Math.min(50, Number(limit) || 10))]
  );

  const results = [];
  for (const row of rows) {
    try {
      const paymentCollection = await getRazorpay().orders.fetchPayments(row.gateway_order_id);
      const payments = paymentCollection.items || [];
      const captured = payments.find((payment) =>
        payment.order_id === row.gateway_order_id &&
        payment.status === 'captured' &&
        payment.captured === true
      );

      if (captured) {
        const result = await markRazorpayPaymentCaptured({
          gatewayOrderId: row.gateway_order_id,
          gatewayPaymentId: captured.id,
          amount: captured.amount,
          currency: captured.currency,
          signatureVerified: false,
        });
        results.push({ orderId: Number(row.order_id), status: 'PAID', emailDelivery: result.emailResults });
        continue;
      }

      const authorised = payments.some((payment) =>
        payment.order_id === row.gateway_order_id && payment.status === 'authorized'
      );
      const created = payments.some((payment) =>
        payment.order_id === row.gateway_order_id && ['created', 'pending'].includes(payment.status)
      );

      if (authorised || created) {
        results.push({ orderId: Number(row.order_id), status: 'PENDING' });
        continue;
      }

      const latestFailed = [...payments].reverse().find((payment) =>
        payment.order_id === row.gateway_order_id && payment.status === 'failed'
      );

      const result = await markRazorpayPaymentFailed({
        gatewayOrderId: row.gateway_order_id,
        gatewayPaymentId: latestFailed?.id || null,
      });
      results.push({ orderId: Number(row.order_id), status: result.paymentStatus });
    } catch (error) {
      results.push({
        orderId: Number(row.order_id),
        status: 'RECONCILIATION_FAILED',
        error: String(error?.message || 'Unknown error'),
      });
    }
  }

  return { checked: rows.length, results };
}

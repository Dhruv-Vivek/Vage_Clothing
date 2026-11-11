import 'server-only';

/**
 * EMBEDDED MYSQL: reconciles local pending order/payment rows with authoritative Razorpay/Cashfree gateway states.
 * See backend/README.md for the database/backend walkthrough.
 */

import { getPool } from '@/lib/db';
import { getRazorpay } from '@/lib/razorpay';
import {
  fetchCashfreeOrder,
  fetchCashfreePayments,
} from '@/lib/payments/cashfree';
import {
  markGatewayPaymentCaptured,
  markGatewayPaymentFailed,
  markGatewayPaymentPending,
  markRazorpayPaymentCaptured,
  markRazorpayPaymentFailed,
} from '@/lib/order-payments';

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

/**
 * Reconcile very old pending checkouts against their actual provider before
 * releasing stock. Captured/paid payments are finalised; unsettled attempts
 * remain pending. Expired/terminal unpaid checkouts are cancelled once.
 */
export async function reconcilePendingCheckouts(limit = 10) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT o.order_id, o.order_number, g.gateway_order_id, g.gateway
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
    const gateway = String(row.gateway || '').toUpperCase();
    try {
      if (gateway === 'DEMO') {
        const result = await markGatewayPaymentFailed({
          gateway: 'DEMO',
          gatewayOrderId: row.gateway_order_id,
        });
        results.push({ orderId: Number(row.order_id), status: result.paymentStatus, provider: gateway });
        continue;
      }

      if (gateway === 'CASHFREE') {
        const [remoteOrder, paymentResponse] = await Promise.all([
          fetchCashfreeOrder(row.gateway_order_id),
          fetchCashfreePayments(row.gateway_order_id),
        ]);
        const payments = Array.isArray(paymentResponse)
          ? paymentResponse
          : Array.isArray(paymentResponse?.data) ? paymentResponse.data : [];

        const successful = payments.find((payment) =>
          payment.order_id === row.gateway_order_id &&
          payment.payment_status === 'SUCCESS'
        );

        if (successful) {
          if (remoteOrder.order_status !== 'PAID') {
            await markGatewayPaymentPending({
              gateway: 'CASHFREE',
              gatewayOrderId: row.gateway_order_id,
            });
            results.push({ orderId: Number(row.order_id), status: 'PENDING', provider: gateway });
            continue;
          }

          if (
            toCents(remoteOrder.order_amount) !== toCents(successful.payment_amount) ||
            String(remoteOrder.order_currency).toUpperCase() !== String(successful.payment_currency || 'INR').toUpperCase()
          ) {
            throw new Error('Cashfree reports a paid order but its amount/currency does not match the payment attempt.');
          }

          const result = await markGatewayPaymentCaptured({
            gateway: 'CASHFREE',
            gatewayOrderId: row.gateway_order_id,
            gatewayPaymentId: String(successful.cf_payment_id),
            amount: toCents(successful.payment_amount),
            currency: successful.payment_currency || remoteOrder.order_currency,
            signatureVerified: false,
          });
          results.push({
            orderId: Number(row.order_id),
            status: 'PAID',
            provider: gateway,
            emailDelivery: result.emailResults,
          });
          continue;
        }

        if (remoteOrder.order_status === 'PAID') {
          throw new Error('Cashfree reports the order as PAID, but no successful payment attempt was returned.');
        }

        const outstanding = payments.some((payment) =>
          ['PENDING', 'NOT_ATTEMPTED'].includes(String(payment.payment_status || '').toUpperCase())
        );
        if (outstanding) {
          await markGatewayPaymentPending({
            gateway: 'CASHFREE',
            gatewayOrderId: row.gateway_order_id,
          });
          results.push({ orderId: Number(row.order_id), status: 'PENDING', provider: gateway });
          continue;
        }

        const result = await markGatewayPaymentFailed({
          gateway: 'CASHFREE',
          gatewayOrderId: row.gateway_order_id,
          gatewayPaymentId: payments.length
            ? String(payments[payments.length - 1].cf_payment_id || '')
            : null,
        });
        results.push({ orderId: Number(row.order_id), status: result.paymentStatus, provider: gateway });
        continue;
      }

      if (gateway === 'RAZORPAY') {
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
          results.push({ orderId: Number(row.order_id), status: 'PAID', provider: gateway, emailDelivery: result.emailResults });
          continue;
        }

        const authorised = payments.some((payment) =>
          payment.order_id === row.gateway_order_id && payment.status === 'authorized'
        );
        const created = payments.some((payment) =>
          payment.order_id === row.gateway_order_id && ['created', 'pending'].includes(payment.status)
        );

        if (authorised || created) {
          results.push({ orderId: Number(row.order_id), status: 'PENDING', provider: gateway });
          continue;
        }

        const latestFailed = [...payments].reverse().find((payment) =>
          payment.order_id === row.gateway_order_id && payment.status === 'failed'
        );
        const result = await markRazorpayPaymentFailed({
          gatewayOrderId: row.gateway_order_id,
          gatewayPaymentId: latestFailed?.id || null,
        });
        results.push({ orderId: Number(row.order_id), status: result.paymentStatus, provider: gateway });
        continue;
      }

      results.push({
        orderId: Number(row.order_id),
        status: 'SKIPPED',
        error: 'Unknown payment provider.',
      });
    } catch (error) {
      results.push({
        orderId: Number(row.order_id),
        status: 'RECONCILIATION_FAILED',
        provider: gateway,
        error: String(error?.message || 'Unknown error'),
      });
    }
  }

  return { checked: rows.length, results };
}

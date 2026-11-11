import 'server-only';

/**
 * EMBEDDED MYSQL: processes persisted Razorpay webhook events and updates payment/order state after gateway verification.
 * See backend/README.md for the database/backend walkthrough.
 */

import { getPool } from '@/lib/db';
import { getRazorpay } from '@/lib/razorpay';
import {
  markGatewayPaymentCaptured,
  markRazorpayPaymentAuthorized,
} from '@/lib/order-payments';
import {
  markMembershipPurchaseCaptured,
  markMembershipPurchaseAuthorized,
} from '@/lib/membership';

function parsePayload(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') return parsed;
  }
  throw new Error('Stored Razorpay webhook payload is invalid.');
}

async function setEventStatus(pool, eventId, status, error = null) {
  await pool.execute(
    `UPDATE razorpay_webhook_events
     SET processing_status = ?, last_error = ?,
         processed_at = IF(? = 'PROCESSED', NOW(), processed_at)
     WHERE razorpay_webhook_event_id = ?`,
    [status, error, status, eventId]
  );
}

/**
 * Process already-verified, durably stored webhook events.
 * The HTTP webhook route only persists and acknowledges events; this worker
 * performs provider API calls and VAGE state transitions asynchronously.
 */
export async function dispatchPendingRazorpayWebhookEvents(limit = 10) {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(25, Number(limit) || 10));
  const [rows] = await pool.execute(
    `SELECT razorpay_webhook_event_id, provider_event_id, event_type, payload
     FROM razorpay_webhook_events
     WHERE (
       processing_status IN ('RECEIVED','FAILED')
       AND attempts < 5
     ) OR (
       processing_status = 'PROCESSING'
       AND attempts < 5
       AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
     )
     ORDER BY received_at, razorpay_webhook_event_id
     LIMIT ?`,
    [safeLimit]
  );

  const results = [];
  for (const row of rows) {
    const [claim] = await pool.execute(
      `UPDATE razorpay_webhook_events
       SET processing_status = 'PROCESSING',
           attempts = attempts + 1,
           last_error = NULL
       WHERE razorpay_webhook_event_id = ?
         AND attempts < 5
         AND (
           processing_status IN ('RECEIVED','FAILED')
           OR (
             processing_status = 'PROCESSING'
             AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
           )
         )`,
      [row.razorpay_webhook_event_id]
    );

    if (claim.affectedRows !== 1) {
      results.push({
        providerEventId: row.provider_event_id,
        status: 'SKIPPED',
      });
      continue;
    }

    try {
      const event = parsePayload(row.payload);
      if (!['payment.captured', 'payment.failed', 'payment.authorized'].includes(row.event_type)) {
        await setEventStatus(pool, row.razorpay_webhook_event_id, 'PROCESSED');
        results.push({ providerEventId: row.provider_event_id, status: 'IGNORED', eventType: row.event_type });
        continue;
      }

      const paymentEntity =
        event.payload?.payment?.entity ||
        event.payload?.order?.entity?.payments?.items?.[0] ||
        null;

      if (!paymentEntity?.id || !paymentEntity?.order_id) {
        await setEventStatus(pool, row.razorpay_webhook_event_id, 'PROCESSED');
        results.push({ providerEventId: row.provider_event_id, status: 'IGNORED', reason: 'Missing payment reference' });
        continue;
      }

      const [knownOrders] = await pool.execute(
        `SELECT order_payment_gateway_id
         FROM order_payment_gateways
         WHERE gateway_order_id = ? AND gateway = 'RAZORPAY'
         LIMIT 1`,
        [paymentEntity.order_id]
      );
      const [membershipPayments] = await pool.execute(
        `SELECT membership_payment_id
         FROM membership_payment_transactions
         WHERE gateway_order_id = ? AND gateway = 'RAZORPAY'
         LIMIT 1`,
        [paymentEntity.order_id]
      );

      if (!knownOrders.length && !membershipPayments.length) {
        await setEventStatus(pool, row.razorpay_webhook_event_id, 'PROCESSED');
        results.push({ providerEventId: row.provider_event_id, status: 'IGNORED', reason: 'Not a VAGE order or membership payment' });
        continue;
      }

      // Fetch the latest payment state instead of trusting event order. A
      // captured payment can already exist when an older authorized event lands.
      const livePayment = await getRazorpay().payments.fetch(paymentEntity.id);
      if (livePayment.order_id !== paymentEntity.order_id) {
        throw new Error('Fetched payment does not match the webhook order.');
      }

      if (knownOrders.length) {
        if (livePayment.status === 'captured' && livePayment.captured === true) {
          await markGatewayPaymentCaptured({
            gateway: 'RAZORPAY',
            gatewayOrderId: livePayment.order_id,
            gatewayPaymentId: livePayment.id,
            amount: livePayment.amount,
            currency: livePayment.currency,
            signatureVerified: true,
            queueEmails: true,
            dispatchEmails: false,
          });
        } else if (livePayment.status === 'authorized') {
          await markRazorpayPaymentAuthorized({
            gatewayOrderId: livePayment.order_id,
            gatewayPaymentId: livePayment.id,
          });
        }
      } else {
        const membershipPaymentId = Number(membershipPayments[0].membership_payment_id);
        if (livePayment.status === 'captured' && livePayment.captured === true) {
          await markMembershipPurchaseCaptured({
            purchaseId: membershipPaymentId,
            gatewayOrderId: livePayment.order_id,
            gatewayPaymentId: livePayment.id,
            amount: livePayment.amount,
            currency: livePayment.currency,
            signatureVerified: true,
          });
        } else if (livePayment.status === 'authorized') {
          await markMembershipPurchaseAuthorized({
            purchaseId: membershipPaymentId,
            gatewayPaymentId: livePayment.id,
          });
        }
      }
      // A failed payment attempt is not immediately final: Checkout can permit
      // another attempt in the same modal. Dismissal/reconciliation owns release.

      await setEventStatus(pool, row.razorpay_webhook_event_id, 'PROCESSED');
      results.push({
        providerEventId: row.provider_event_id,
        eventType: row.event_type,
        status: 'PROCESSED',
        paymentStatus: livePayment.status,
      });
    } catch (error) {
      const message = String(error?.message || 'Razorpay webhook processing failed.').slice(0, 950);
      await setEventStatus(pool, row.razorpay_webhook_event_id, 'FAILED', message).catch(() => undefined);
      results.push({
        providerEventId: row.provider_event_id,
        eventType: row.event_type,
        status: 'FAILED',
        error: message,
      });
    }
  }

  return { checked: rows.length, results };
}

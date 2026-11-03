import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getPool } from '@/lib/db';
import {
  fetchCashfreeOrder,
  fetchCashfreePayments,
  verifyCashfreeWebhookSignature,
} from '@/lib/payments/cashfree';
import { markGatewayPaymentCaptured } from '@/lib/order-payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  const rawBody = await request.text();
  if (!rawBody || Buffer.byteLength(rawBody, 'utf8') > 1024 * 1024) {
    return jsonError('Invalid webhook payload.', 413);
  }

  const signature = request.headers.get('x-webhook-signature') || '';
  const timestamp = request.headers.get('x-webhook-timestamp') || '';

  try {
    if (!verifyCashfreeWebhookSignature(rawBody, signature, timestamp)) {
      return jsonError('Invalid Cashfree webhook signature.', 400);
    }
  } catch (error) {
    console.error('Cashfree webhook configuration error:', error);
    return jsonError('Cashfree webhook receiver is not configured.', 503);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonError('Webhook body is not valid JSON.', 400);
  }

  const eventType = typeof event?.type === 'string' ? event.type : '';
  const gatewayOrderId = event?.data?.order?.order_id || event?.data?.payment?.order_id;
  const cfPaymentId = event?.data?.payment?.cf_payment_id;

  if (!eventType || typeof gatewayOrderId !== 'string') {
    return jsonError('Unsupported Cashfree webhook payload.', 400);
  }

  const providerEventId = createHash('sha256')
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const pool = getPool();
  try {
    await pool.execute(
      `INSERT INTO cashfree_webhook_events
         (provider_event_id, event_type, payload, processing_status, attempts)
       VALUES (?, ?, ?, 'RECEIVED', 1)
       ON DUPLICATE KEY UPDATE
         attempts = attempts + 1,
         processing_status = IF(processing_status = 'PROCESSED', 'PROCESSED', 'RECEIVED'),
         last_error = NULL`,
      [providerEventId, eventType, rawBody]
    );

    const [stored] = await pool.execute(
      'SELECT processing_status FROM cashfree_webhook_events WHERE provider_event_id = ? LIMIT 1',
      [providerEventId]
    );
    if (stored[0]?.processing_status === 'PROCESSED') {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const [linked] = await pool.execute(
      `SELECT o.order_id, g.gateway_order_id
       FROM order_payment_gateways g
       INNER JOIN payments p ON p.payment_id = g.payment_id
       INNER JOIN orders o ON o.order_id = p.order_id
       WHERE g.gateway = 'CASHFREE' AND g.gateway_order_id = ?
       LIMIT 1`,
      [gatewayOrderId]
    );

    if (!linked.length) {
      await pool.execute(
        `UPDATE cashfree_webhook_events
         SET processing_status = 'PROCESSED', processed_at = NOW()
         WHERE provider_event_id = ?`,
        [providerEventId]
      );
      return NextResponse.json({ received: true, ignored: true });
    }

    // A success webhook is only a signal to reconcile. The authoritative status
    // and amount are read from Cashfree's server-side APIs before the order is paid.
    if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' && cfPaymentId) {
      const [remoteOrder, remotePayments] = await Promise.all([
        fetchCashfreeOrder(gatewayOrderId),
        fetchCashfreePayments(gatewayOrderId),
      ]);
      const payments = Array.isArray(remotePayments)
        ? remotePayments
        : Array.isArray(remotePayments?.data) ? remotePayments.data : [];
      const successful = payments.find((payment) =>
        String(payment.cf_payment_id) === String(cfPaymentId) &&
        payment.order_id === gatewayOrderId &&
        payment.payment_status === 'SUCCESS'
      );

      if (remoteOrder.order_status === 'PAID' && successful) {
        await markGatewayPaymentCaptured({
          gateway: 'CASHFREE',
          gatewayOrderId,
          gatewayPaymentId: String(successful.cf_payment_id),
          amount: Math.round(Number(successful.payment_amount) * 100),
          currency: successful.payment_currency || remoteOrder.order_currency,
          signatureVerified: true,
          dispatchEmails: false,
        });
      }
    }

    await pool.execute(
      `UPDATE cashfree_webhook_events
       SET processing_status = 'PROCESSED', processed_at = NOW(), last_error = NULL
       WHERE provider_event_id = ?`,
      [providerEventId]
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = String(error?.message || 'Cashfree webhook processing failed.').slice(0, 950);
    await pool.execute(
      `UPDATE cashfree_webhook_events
       SET processing_status = 'FAILED', last_error = ?
       WHERE provider_event_id = ?`,
      [message, providerEventId]
    ).catch(() => undefined);
    console.error('[POST /api/webhooks/cashfree] Processing failed:', error);
    return jsonError('Cashfree webhook processing failed. Cashfree may retry delivery.', 500);
  }
}

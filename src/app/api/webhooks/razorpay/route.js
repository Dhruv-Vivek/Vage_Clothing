import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getPool } from '@/lib/db';
import { getRazorpay, verifyWebhookSignature } from '@/lib/razorpay';
import {
  markRazorpayPaymentCaptured,
} from '@/lib/order-payments';

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

  const signature = request.headers.get('x-razorpay-signature') || '';
  try {
    if (!verifyWebhookSignature(rawBody, signature)) {
      return jsonError('Invalid Razorpay webhook signature.', 400);
    }
  } catch (error) {
    console.error('Razorpay webhook secret configuration error:', error);
    return jsonError('Webhook receiver is not configured.', 500);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonError('Webhook body is not valid JSON.', 400);
  }

  if (!event || typeof event.event !== 'string' || !event.payload) {
    return jsonError('Unsupported webhook payload.', 400);
  }

  const providerEventId = (
    request.headers.get('x-razorpay-event-id') ||
    createHash('sha256').update(rawBody).digest('hex')
  ).slice(0, 120);

  const pool = getPool();
  try {
    await pool.execute(
      `INSERT INTO razorpay_webhook_events
         (provider_event_id, event_type, payload, processing_status, attempts)
       VALUES (?, ?, ?, 'RECEIVED', 1)
       ON DUPLICATE KEY UPDATE
         attempts = attempts + 1,
         processing_status = IF(processing_status = 'PROCESSED', 'PROCESSED', 'RECEIVED'),
         last_error = NULL`,
      [providerEventId, event.event, rawBody]
    );

    const [stored] = await pool.execute(
      'SELECT processing_status FROM razorpay_webhook_events WHERE provider_event_id = ? LIMIT 1',
      [providerEventId]
    );

    if (stored[0]?.processing_status === 'PROCESSED') {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const paymentEntity =
      event.payload?.payment?.entity ||
      event.payload?.order?.entity?.payments?.items?.[0] ||
      null;

    if (['payment.captured', 'payment.failed', 'payment.authorized'].includes(event.event)) {
      if (!paymentEntity?.id || !paymentEntity?.order_id) {
        throw new Error('Payment webhook is missing payment or Razorpay order identifiers.');
      }

      // Re-fetch on failure/authorisation events. Webhooks can arrive out of order;
      // only the live captured state may mark an order paid.
      const livePayment = await getRazorpay().payments.fetch(paymentEntity.id);
      if (livePayment.order_id !== paymentEntity.order_id) {
        throw new Error('Fetched payment does not match the webhook order.');
      }

      if (livePayment.status === 'captured' && livePayment.captured === true) {
        await markRazorpayPaymentCaptured({
          gatewayOrderId: livePayment.order_id,
          gatewayPaymentId: livePayment.id,
          amount: livePayment.amount,
          currency: livePayment.currency,
          signatureVerified: true,
          dispatchEmails: false,
        });
      } else if (livePayment.status === 'authorized') {
        const { markRazorpayPaymentAuthorized } = await import('@/lib/order-payments');
        await markRazorpayPaymentAuthorized({
          gatewayOrderId: livePayment.order_id,
          gatewayPaymentId: livePayment.id,
        });
      }
      // A failed attempt does not cancel the order here: Razorpay may still
      // accept another attempt in the same Checkout session. Reconcile only
      // after the customer dismisses Checkout or through the stale-order job.
    }

    await pool.execute(
      `UPDATE razorpay_webhook_events
       SET processing_status = 'PROCESSED', processed_at = NOW(), last_error = NULL
       WHERE provider_event_id = ?`,
      [providerEventId]
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = String(error?.message || 'Webhook processing failed.').slice(0, 950);
    await pool.execute(
      `UPDATE razorpay_webhook_events
       SET processing_status = 'FAILED', last_error = ?
       WHERE provider_event_id = ?`,
      [message, providerEventId]
    ).catch(() => undefined);
    console.error('[POST /api/webhooks/razorpay] Processing failed:', error);
    return jsonError('Webhook processing failed. Razorpay may retry delivery.', 500);
  }
}

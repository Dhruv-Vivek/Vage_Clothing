// EMBEDDED MYSQL: the Razorpay webhook persists provider events and protects processing with unique keys/transactions before the worker reconciles payment state.
import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getPool } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Verify and durably store Razorpay events, then acknowledge immediately.
 * Provider API calls and order mutations are handled by the scheduled worker.
 */
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

  if (!event || typeof event.event !== 'string' || !event.payload || typeof event.payload !== 'object') {
    return jsonError('Unsupported webhook payload.', 400);
  }

  const providerEventId = (
    request.headers.get('x-razorpay-event-id') ||
    createHash('sha256').update(rawBody).digest('hex')
  ).slice(0, 120);

  const pool = getPool();
  try {
    // A duplicate delivery does not reset a PROCESSING/PROCESSED event or
    // increment processing attempts. The unique key closes concurrent races.
    await pool.execute(
      `INSERT INTO razorpay_webhook_events
         (provider_event_id, event_type, payload, processing_status, attempts)
       VALUES (?, ?, ?, 'RECEIVED', 0)
       ON DUPLICATE KEY UPDATE provider_event_id = VALUES(provider_event_id)`,
      [providerEventId, event.event, rawBody]
    );

    const [stored] = await pool.execute(
      `SELECT processing_status
       FROM razorpay_webhook_events
       WHERE provider_event_id = ?
       LIMIT 1`,
      [providerEventId]
    );

    return NextResponse.json({
      received: true,
      queued: stored[0]?.processing_status !== 'PROCESSED',
      duplicate: stored[0]?.processing_status === 'PROCESSED',
    });
  } catch (error) {
    console.error('[POST /api/webhooks/razorpay] Durable event intake failed:', error);
    // A 5xx response tells Razorpay that the event was not durably accepted.
    return jsonError('Webhook event could not be stored. Razorpay may retry delivery.', 503);
  }
}

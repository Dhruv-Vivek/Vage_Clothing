import { NextResponse } from 'next/server';
import { dispatchPendingEmails } from '@/lib/order-email';
import { dispatchPendingContactEmails } from '@/lib/contact-email';
import { dispatchPendingRazorpayWebhookEvents } from '@/lib/razorpay-webhook-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.startsWith('replace_with_')) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization') || '';
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const [orderEmails, contactEmails, razorpayWebhooks] = await Promise.all([
      dispatchPendingEmails(20),
      dispatchPendingContactEmails(20),
      dispatchPendingRazorpayWebhookEvents(10),
    ]);
    return NextResponse.json({ orderEmails, contactEmails, razorpayWebhooks });
  } catch (error) {
    console.error('[POST /api/cron/dispatch-email-outbox] Failed:', error);
    return NextResponse.json({ error: 'Email outbox dispatch failed.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { dispatchPaidOrderEmails } from '@/lib/order-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request, context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const rawId = (await context.params).id;
  if (!/^\d+$/.test(String(rawId))) {
    return NextResponse.json({ error: 'Invalid order ID.' }, { status: 400 });
  }
  const orderId = Number(rawId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: 'Invalid order ID.' }, { status: 400 });
  }

  const rows = await query(
    'SELECT order_id FROM orders WHERE order_id = ? AND user_id = ? AND payment_status = ? LIMIT 1',
    [orderId, user.id, 'PAID']
  );
  if (!rows.length) {
    return NextResponse.json({ error: 'A receipt can only be resent for a paid order.' }, { status: 404 });
  }

  const results = await dispatchPaidOrderEmails(orderId);
  return NextResponse.json({ results });
}

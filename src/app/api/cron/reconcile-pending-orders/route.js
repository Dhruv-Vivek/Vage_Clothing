import { NextResponse } from 'next/server';
import { reconcilePendingCheckouts } from '@/lib/order-reconciliation';

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
    const result = await reconcilePendingCheckouts(10);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/cron/reconcile-pending-orders] Failed:', error);
    return NextResponse.json({ error: 'Pending checkout reconciliation failed.' }, { status: 500 });
  }
}

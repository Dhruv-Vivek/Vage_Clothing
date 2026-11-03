import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { cancelOrder } from '@/lib/order-lifecycle';
import { HttpError } from '@/lib/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request, context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const rawId = (await context.params).id;
  if (!/^\d+$/.test(String(rawId)) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) <= 0) {
    return NextResponse.json({ error: 'Invalid order ID.' }, { status: 400 });
  }
  try {
    const result = await cancelOrder({ orderId: Number(rawId), userId: user.id, actor: user });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error('[POST /api/orders/:id/cancel]', error);
    return NextResponse.json({ error: status === 500 ? 'Unable to cancel this order right now.' : error.message }, { status });
  }
}

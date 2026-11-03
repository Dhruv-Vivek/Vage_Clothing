import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createReturnRequest } from '@/lib/order-lifecycle';
import { HttpError } from '@/lib/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const rawId = (await context.params).id;
  if (!/^\d+$/.test(String(rawId)) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) <= 0) {
    return NextResponse.json({ error: 'Invalid order ID.' }, { status: 400 });
  }
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const orderItemId = Number(body?.orderItemId);
  const quantity = Number(body?.quantity);
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!Number.isSafeInteger(orderItemId) || orderItemId <= 0) return NextResponse.json({ error: 'Select a valid order item.' }, { status: 422 });
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) return NextResponse.json({ error: 'Return quantity must be between 1 and 10.' }, { status: 422 });
  if (reason.length < 10 || reason.length > 500) return NextResponse.json({ error: 'Return reason must contain 10 to 500 characters.' }, { status: 422 });
  try {
    const result = await createReturnRequest({ userId: user.id, orderId: Number(rawId), orderItemId, quantity, reason });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error('[POST /api/orders/:id/returns]', error);
    return NextResponse.json({ error: status === 500 ? 'Unable to submit this return request.' : error.message }, { status });
  }
}

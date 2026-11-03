import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createMembershipPurchase } from '@/lib/membership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to purchase a membership.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  try {
    const result = await createMembershipPurchase(user, body?.planCode, body?.idempotencyKey);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    const message = String(error?.message || 'Unable to start membership purchase.');
    const status = /sign in/i.test(message) ? 401
      : /not available|Choose|invalid|Renewal opens|active membership|queued|payment in progress|purchase attempt failed/i.test(message) ? 409
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

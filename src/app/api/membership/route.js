import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMembershipPlans, getMembershipSnapshot } from '@/lib/membership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const plans = await getMembershipPlans();
    const user = await getCurrentUser();
    const summary = user ? await getMembershipSnapshot(user.id) : null;
    return NextResponse.json(
      { plans, summary },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('[GET /api/membership] Failed:', error);
    return NextResponse.json({ error: 'Unable to load membership plans.' }, { status: 500 });
  }
}

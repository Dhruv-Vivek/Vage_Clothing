import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { cancelQueuedMembership } from '@/lib/membership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const membershipId = Number(body?.membershipId);
  if (!Number.isSafeInteger(membershipId) || membershipId <= 0) {
    return NextResponse.json({ error: 'Invalid membership ID.' }, { status: 400 });
  }

  try {
    await cancelQueuedMembership(user.id, membershipId);
    return NextResponse.json({ cancelled: true, message: 'The queued renewal was cancelled.' });
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || 'Unable to cancel membership.') }, { status: 409 });
  }
}

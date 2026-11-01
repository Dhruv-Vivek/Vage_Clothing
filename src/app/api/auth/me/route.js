import { NextResponse } from 'next/server';
import { getCurrentUser, expiredSessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const response = NextResponse.json({ user });

    // Clear an invalid/stale cookie when its account no longer exists or is disabled.
    if (!user) response.cookies.set(SESSION_COOKIE, '', expiredSessionCookieOptions());
    return response;
  } catch (error) {
    console.error('Session lookup failed:', error);
    return NextResponse.json(
      { error: 'Unable to verify your session right now.' },
      { status: 500 }
    );
  }
}

// EMBEDDED MYSQL: authentication loads the user record with a parameterized SELECT; passwords are verified server-side.
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  toPublicUser,
  verifyPassword,
} from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonError('A valid JSON object is required.', 400);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) {
    return jsonError('Enter a valid email address.', 400);
  }
  if (!password || new TextEncoder().encode(password).length > 72) {
    return jsonError('Enter a valid password.', 400);
  }

  try {
    const rows = await query(
      `SELECT user_id, full_name, email, phone, password_hash, role, is_active
         FROM users
        WHERE email = ?
        LIMIT 1`,
      [email]
    );

    const userRow = rows[0];
    if (!userRow || !userRow.is_active || !(await verifyPassword(password, userRow.password_hash))) {
      return jsonError('Incorrect email or password.', 401);
    }

    const token = await createSessionToken(userRow.user_id, userRow.role);
    const response = NextResponse.json({ user: toPublicUser(userRow) });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    console.error('Login failed:', error);
    return jsonError('Unable to sign in right now. Please try again.', 500);
  }
}

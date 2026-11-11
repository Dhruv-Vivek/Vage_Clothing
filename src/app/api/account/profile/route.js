// EMBEDDED MYSQL: profile reads/updates are parameterized SELECT and UPDATE statements executed server-side through mysql2.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function profilePayload(row) {
  return {
    id: Number(row.user_id),
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || '',
    role: row.role,
    createdAt: row.created_at,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  try {
    const [rows] = await getPool().execute(
      'SELECT user_id, full_name, email, phone, role, created_at FROM users WHERE user_id = ? AND is_active = 1 LIMIT 1',
      [user.id]
    );
    if (!rows.length) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    return NextResponse.json({ profile: profilePayload(rows[0]) }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('[GET /api/account/profile] Failed:', error);
    return NextResponse.json({ error: 'Unable to load your profile.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phoneRaw = typeof body?.phone === 'string' ? body.phone : '';
  const phone = phoneRaw.replace(/\D/g, '');

  if (fullName.length < 2 || fullName.length > 120) {
    return NextResponse.json({ error: 'Name must contain 2 to 120 characters.' }, { status: 400 });
  }
  if (email.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (phone && (phone.length < 10 || phone.length > 15)) {
    return NextResponse.json({ error: 'Phone number must contain 10 to 15 digits.' }, { status: 400 });
  }

  try {
    const pool = getPool();
    await pool.execute(
      'UPDATE users SET full_name = ?, email = ?, phone = ? WHERE user_id = ? AND is_active = 1',
      [fullName, email, phone || null, user.id]
    );
    const [rows] = await pool.execute(
      'SELECT user_id, full_name, email, phone, role, created_at FROM users WHERE user_id = ? LIMIT 1',
      [user.id]
    );
    if (!rows.length) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    return NextResponse.json({ profile: profilePayload(rows[0]), message: 'Your profile has been updated.' });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'That email address is already associated with another account.' }, { status: 409 });
    }
    console.error('[PATCH /api/account/profile] Failed:', error);
    return NextResponse.json({ error: 'Unable to update your profile.' }, { status: 500 });
  }
}

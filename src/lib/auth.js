import 'server-only';

import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

export const SESSION_COOKIE = 'vage_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const SESSION_ISSUER = 'vage-clothing';
const SESSION_AUDIENCE = 'vage-clothing-web';

function getSigningKey() {
  const value = process.env.JWT_SECRET;
  if (!value || value.startsWith('replace_with_') || value.length < 32) {
    throw new Error(
      'JWT_SECRET is missing or too short. Set a random secret of at least 32 characters in .env.local.'
    );
  }
  return new TextEncoder().encode(value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function expiredSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSessionToken(userId, role) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSigningKey());
}

/** Return the verified session identity, or null when there is no valid cookie. */
export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      algorithms: ['HS256'],
    });

    const id = Number(payload.sub);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return { id };
  } catch {
    return null;
  }
}

/**
 * Resolve the signed identity against MySQL on every request. This means a
 * disabled account or changed role takes effect without waiting for JWT expiry.
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const rows = await query(
    `SELECT user_id, full_name, email, phone, role, is_active
       FROM users
      WHERE user_id = ? AND is_active = 1
      LIMIT 1`,
    [session.id]
  );

  if (!rows.length) return null;
  const user = toPublicUser(rows[0]);
  try {
    const memberships = await query(
      "SELECT LOWER(mp.plan_code) AS plan_code " +
      "FROM user_memberships um INNER JOIN membership_plans mp ON mp.plan_id = um.plan_id " +
      "WHERE um.user_id = ? AND um.status = 'ACTIVE' AND um.starts_at <= NOW() " +
      "AND um.expires_at > NOW() AND mp.is_active = 1 ORDER BY um.expires_at DESC LIMIT 1",
      [session.id]
    );
    if (memberships.length) user.membership = memberships[0].plan_code;
  } catch (error) {
    // Authentication must remain available while an optional membership read is unavailable.
    console.error('Unable to resolve membership status:', error?.message || error);
  }
  return user;
}

export function toPublicUser(row) {
  return {
    id: Number(row.user_id),
    name: row.full_name,
    email: row.email,
    phone: row.phone || null,
    role: row.role,
    // Membership persistence is scheduled for the membership integration batch.
    membership: 'none',
  };
}

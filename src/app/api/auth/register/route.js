// EMBEDDED MYSQL: registration writes the new customer using a parameterized INSERT after server-side validation and password hashing.
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import {
  createSessionToken,
  hashPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
  toPublicUser,
} from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status });
}

function validateRegistration(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'A valid JSON object is required.' };
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';

  if (fullName.length < 2 || fullName.length > 120) {
    return { error: 'Full name must contain between 2 and 120 characters.' };
  }
  if (email.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email address.' };
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters long.' };
  }
  if (new TextEncoder().encode(password).length > 72) {
    return { error: 'Password must not exceed 72 UTF-8 bytes.' };
  }

  let phone = null;
  if (rawPhone) {
    if (!/^\+?[0-9\s()-]+$/.test(rawPhone)) {
      return { error: 'Phone number can contain only digits and standard phone formatting characters.' };
    }
    phone = rawPhone.replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 15) {
      return { error: 'Phone number must contain 10 to 15 digits, including country code if supplied.' };
    }
  }

  return { value: { fullName, email, password, phone } };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  const validation = validateRegistration(body);
  if (validation.error) return jsonError(validation.error, 400);
  const { fullName, email, password, phone } = validation.value;

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [insertResult] = await connection.execute(
      `INSERT INTO users (full_name, email, phone, password_hash)
       VALUES (?, ?, ?, ?)`,
      [fullName, email, phone, await hashPassword(password)]
    );

    const userId = Number(insertResult.insertId);

    // Every new customer starts with one active, empty cart.
    await connection.execute(
      `INSERT INTO carts (user_id, status) VALUES (?, 'ACTIVE')`,
      [userId]
    );

    // Create the token before commit; if token signing fails, roll back account creation.
    const token = await createSessionToken(userId, 'CUSTOMER');
    await connection.commit();

    const user = toPublicUser({
      user_id: userId,
      full_name: fullName,
      email,
      phone,
      role: 'CUSTOMER',
      is_active: 1,
    });

    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // The connection may already have rolled back after a failed transaction.
    }

    if (error?.code === 'ER_DUP_ENTRY') {
      return jsonError('An account with this email address already exists.', 409);
    }

    console.error('Registration failed:', error);
    return jsonError('Unable to create your account right now. Please try again.', 500);
  } finally {
    connection.release();
  }
}

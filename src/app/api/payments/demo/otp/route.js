import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { isDemoPaymentsEnabled } from '@/lib/payments/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEMO_OTP = '111000';
const OTP_TTL_SECONDS = 5 * 60;
const PAYMENT_METHODS = new Set(['UPI', 'CARD', 'NETBANKING', 'WALLET']);

function sha256(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  if (!isDemoPaymentsEnabled() || process.env.NODE_ENV === 'production') {
    return jsonError('Demo payment verification is disabled.', 404);
  }

  const user = await getCurrentUser();
  if (!user) return jsonError('Please sign in before starting demo checkout.', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  const orderId = Number(body?.orderId);
  const paymentMethod = String(body?.paymentMethod || '').trim().toUpperCase();
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return jsonError('Invalid order reference.', 400);
  }
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    return jsonError('Choose UPI, Card, Net Banking or Wallet.', 400);
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const salt = randomBytes(16).toString('hex');
  const otpHash = sha256(`${salt}:${DEMO_OTP}`);

  try {
    await connection.beginTransaction();

    const [orders] = await connection.execute(
      `SELECT o.order_id, o.status AS order_status, o.payment_status,
              p.payment_id, g.gateway, g.gateway_order_id
       FROM orders o
       INNER JOIN payments p ON p.order_id = o.order_id
       INNER JOIN order_payment_gateways g ON g.payment_id = p.payment_id
       WHERE o.order_id = ? AND o.user_id = ? AND g.gateway = 'DEMO'
       LIMIT 1
       FOR UPDATE`,
      [orderId, user.id]
    );

    if (!orders.length) {
      await connection.rollback();
      return jsonError('Demo order was not found for this account.', 404);
    }

    const order = orders[0];
    if (order.order_status !== 'PENDING' || order.payment_status !== 'PENDING') {
      await connection.rollback();
      return jsonError('This order is no longer awaiting payment.', 409);
    }

    // Only the newest active OTP session for this order remains usable.
    await connection.execute(
      `UPDATE demo_payment_otp_sessions
       SET status = 'EXPIRED'
       WHERE order_id = ? AND user_id = ? AND status = 'ACTIVE'`,
      [orderId, user.id]
    );

    await connection.execute(
      `INSERT INTO demo_payment_otp_sessions
         (order_id, user_id, token_hash, otp_salt, otp_hash,
          payment_method, attempts, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'ACTIVE',
               DATE_ADD(NOW(), INTERVAL ? SECOND))`,
      [orderId, user.id, tokenHash, salt, otpHash, paymentMethod, OTP_TTL_SECONDS]
    );

    await connection.commit();

    return NextResponse.json({
      success: true,
      sessionToken: rawToken,
      expiresIn: OTP_TTL_SECONDS,
      demoOtp: DEMO_OTP,
      paymentMethod,
      message: 'Local demo OTP session created. No email or SMS was sent.',
    });
  } catch (error) {
    await connection.rollback();
    console.error('[POST /api/payments/demo/otp] Session creation failed:', error);
    return jsonError('Unable to create the demo OTP session.', 500);
  } finally {
    connection.release();
  }
}

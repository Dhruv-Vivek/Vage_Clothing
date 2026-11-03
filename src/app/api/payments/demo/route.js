import { NextResponse } from 'next/server';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { isDemoPaymentsEnabled } from '@/lib/payments/config';
import {
  markGatewayPaymentCaptured,
  markGatewayPaymentFailed,
  markGatewayPaymentPending,
} from '@/lib/order-payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_OTP_ATTEMPTS = 5;
const PAYMENT_METHODS = new Set(['UPI', 'CARD', 'NETBANKING', 'WALLET']);
const OUTCOMES = new Set(['SUCCESS', 'FAILED', 'PENDING', 'USER_DROPPED']);

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function sha256(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function safeHexEqual(left, right) {
  if (
    typeof left !== 'string' ||
    typeof right !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(left) ||
    !/^[a-f0-9]{64}$/i.test(right)
  ) return false;

  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request) {
  if (!isDemoPaymentsEnabled() || process.env.NODE_ENV === 'production') {
    return jsonError('Demo payments are disabled.', 404);
  }

  const user = await getCurrentUser();
  if (!user) return jsonError('Please sign in before completing demo payment.', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  const orderId = Number(body?.orderId);
  const outcome = String(body?.outcome || '').trim().toUpperCase();
  const otp = String(body?.otp || '').trim();
  const sessionToken = typeof body?.sessionToken === 'string' ? body.sessionToken.trim() : '';
  const paymentMethod = String(body?.paymentMethod || '').trim().toUpperCase();

  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !OUTCOMES.has(outcome)) {
    return jsonError('Choose a valid demo payment outcome.', 400);
  }
  if (!/^[0-9]{6}$/.test(otp)) return jsonError('Enter the six-digit demo OTP.', 400);
  if (!/^[a-f0-9]{64}$/i.test(sessionToken)) return jsonError('Request a new demo OTP session.', 400);
  if (!PAYMENT_METHODS.has(paymentMethod)) return jsonError('Invalid demo payment method.', 400);

  const pool = getPool();
  const connection = await pool.getConnection();
  let gatewayOrderId;
  let paymentAmount;

  try {
    await connection.beginTransaction();

    const [sessions] = await connection.execute(
      `SELECT
          s.demo_payment_otp_session_id, s.otp_salt, s.otp_hash,
          s.payment_method, s.attempts, s.status AS otp_status,
          (s.expires_at <= NOW()) AS is_expired,
          o.order_id, o.status AS order_status, o.payment_status,
          p.payment_id, p.amount AS payment_amount,
          g.gateway_order_id, g.gateway
       FROM demo_payment_otp_sessions s
       INNER JOIN orders o ON o.order_id = s.order_id
       INNER JOIN payments p ON p.order_id = o.order_id
       INNER JOIN order_payment_gateways g ON g.payment_id = p.payment_id
       WHERE s.order_id = ? AND s.user_id = ? AND s.token_hash = ?
         AND g.gateway = 'DEMO'
       LIMIT 1
       FOR UPDATE`,
      [orderId, user.id, sha256(sessionToken)]
    );

    if (!sessions.length) {
      await connection.rollback();
      return jsonError('Demo OTP session was not found. Request a new OTP.', 404);
    }

    const session = sessions[0];
    if (session.otp_status !== 'ACTIVE') {
      await connection.rollback();
      return jsonError('This OTP session has already been used or is no longer active. Request a new OTP.', 409);
    }

    if (session.is_expired) {
      await connection.execute(
        `UPDATE demo_payment_otp_sessions
         SET status = 'EXPIRED'
         WHERE demo_payment_otp_session_id = ?`,
        [session.demo_payment_otp_session_id]
      );
      await connection.commit();
      return jsonError('Demo OTP expired. Request a new OTP.', 410);
    }

    if (Number(session.attempts) >= MAX_OTP_ATTEMPTS) {
      await connection.execute(
        `UPDATE demo_payment_otp_sessions
         SET status = 'LOCKED'
         WHERE demo_payment_otp_session_id = ?`,
        [session.demo_payment_otp_session_id]
      );
      await connection.commit();
      return jsonError('Too many OTP attempts. Request a new demo OTP session.', 429);
    }

    if (
      session.order_status !== 'PENDING' ||
      session.payment_status !== 'PENDING' ||
      session.payment_method !== paymentMethod
    ) {
      await connection.rollback();
      return jsonError('This order or payment method is no longer valid.', 409);
    }

    const candidateHash = sha256(`${session.otp_salt}:${otp}`);
    if (!safeHexEqual(candidateHash, session.otp_hash)) {
      const nextAttempts = Number(session.attempts) + 1;
      await connection.execute(
        `UPDATE demo_payment_otp_sessions
         SET attempts = ?, status = ?
         WHERE demo_payment_otp_session_id = ?`,
        [
          nextAttempts,
          nextAttempts >= MAX_OTP_ATTEMPTS ? 'LOCKED' : 'ACTIVE',
          session.demo_payment_otp_session_id,
        ]
      );
      await connection.commit();
      return jsonError(
        nextAttempts >= MAX_OTP_ATTEMPTS
          ? 'Too many incorrect OTP attempts. Request a new demo OTP session.'
          : `Incorrect OTP. ${MAX_OTP_ATTEMPTS - nextAttempts} attempt(s) remaining.`,
        nextAttempts >= MAX_OTP_ATTEMPTS ? 429 : 400
      );
    }

    await connection.execute(
      `UPDATE demo_payment_otp_sessions
       SET attempts = attempts + 1, status = 'CONSUMED', verified_at = NOW()
       WHERE demo_payment_otp_session_id = ? AND status = 'ACTIVE'`,
      [session.demo_payment_otp_session_id]
    );
    await connection.execute(
      `UPDATE payments
       SET payment_method = ?
       WHERE payment_id = ? AND status = 'PENDING'`,
      [session.payment_method, session.payment_id]
    );

    gatewayOrderId = session.gateway_order_id;
    paymentAmount = Number(session.payment_amount);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('[POST /api/payments/demo] OTP verification failed:', error);
    return jsonError('Unable to verify the demo OTP.', 500);
  } finally {
    connection.release();
  }

  try {
    if (outcome === 'PENDING') {
      await markGatewayPaymentPending({
        gateway: 'DEMO',
        gatewayOrderId,
      });
      return NextResponse.json({
        orderId,
        paymentStatus: 'PENDING',
        paymentProvider: 'DEMO',
        demo: true,
        paymentMethod,
        message: 'Demo payment is pending. No money has been collected.',
      }, { status: 202 });
    }

    if (outcome === 'SUCCESS') {
      const paymentId = `demo_${randomBytes(12).toString('hex')}`;
      const result = await markGatewayPaymentCaptured({
        gateway: 'DEMO',
        gatewayOrderId,
        gatewayPaymentId: paymentId,
        amount: Math.round(paymentAmount * 100),
        currency: 'INR',
        signatureVerified: false,
        queueEmails: false,
        dispatchEmails: false,
      });

      return NextResponse.json({
        orderId: result.orderId,
        paymentStatus: result.paymentStatus,
        paymentProvider: 'DEMO',
        paymentMethod,
        demo: true,
        emailDelivery: [],
      });
    }

    const result = await markGatewayPaymentFailed({
      gateway: 'DEMO',
      gatewayOrderId,
      gatewayPaymentId: null,
    });

    return NextResponse.json({
      orderId: result.orderId,
      paymentStatus: result.paymentStatus,
      paymentProvider: 'DEMO',
      paymentMethod,
      demo: true,
      stockReleased: result.stockReleased === true,
      outcome,
    });
  } catch (error) {
    console.error('[POST /api/payments/demo] Outcome processing failed:', error);
    return jsonError('OTP verified, but the demo payment could not be finalised. Check the order status before trying again.', 500);
  }
}

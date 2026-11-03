import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { isDemoPaymentsEnabled } from '@/lib/payments/config';
import {
  markGatewayPaymentCaptured,
  markGatewayPaymentFailed,
} from '@/lib/order-payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OUTCOMES = new Set(['SUCCESS', 'FAILED', 'PENDING', 'USER_DROPPED']);

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
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

  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !OUTCOMES.has(outcome)) {
    return jsonError('Choose a valid demo payment outcome.', 400);
  }

  try {
    const rows = await query(
      `SELECT
          o.order_id, o.order_number, o.status AS order_status,
          o.payment_status, o.total_amount, p.amount AS payment_amount,
          g.gateway_order_id, g.gateway, g.status AS gateway_status,
          g.gateway_payment_id
       FROM orders o
       INNER JOIN payments p ON p.order_id = o.order_id
       INNER JOIN order_payment_gateways g ON g.payment_id = p.payment_id
       WHERE o.order_id = ? AND o.user_id = ? AND g.gateway = 'DEMO'
       LIMIT 1`,
      [orderId, user.id]
    );

    if (!rows.length) return jsonError('Demo checkout was not found for this account.', 404);
    const row = rows[0];

    if (row.payment_status === 'PAID') {
      return NextResponse.json({ paymentStatus: 'PAID', alreadyFinal: true });
    }
    if (row.order_status !== 'PENDING' || row.payment_status !== 'PENDING') {
      return jsonError('This demo checkout is no longer active. Start a new checkout.', 409);
    }

    if (outcome === 'PENDING') {
      await query(
        `UPDATE order_payment_gateways
         SET status = 'PENDING'
         WHERE gateway_order_id = ? AND gateway = 'DEMO' AND status = 'CREATED'`,
        [row.gateway_order_id]
      );
      return NextResponse.json({
        orderId,
        paymentStatus: 'PENDING',
        message: 'Demo payment is pending. No money has been collected.',
      }, { status: 202 });
    }

    if (outcome === 'SUCCESS') {
      const paymentId = row.gateway_payment_id || `demo_${randomBytes(12).toString('hex')}`;
      const result = await markGatewayPaymentCaptured({
        gateway: 'DEMO',
        gatewayOrderId: row.gateway_order_id,
        gatewayPaymentId: paymentId,
        amount: Math.round(Number(row.payment_amount) * 100),
        currency: 'INR',
        signatureVerified: false,
      });

      return NextResponse.json({
        orderId: result.orderId,
        paymentStatus: result.paymentStatus,
        demo: true,
        emailDelivery: result.emailResults,
      });
    }

    const result = await markGatewayPaymentFailed({
      gateway: 'DEMO',
      gatewayOrderId: row.gateway_order_id,
      gatewayPaymentId: row.gateway_payment_id || null,
    });

    return NextResponse.json({
      orderId: result.orderId,
      paymentStatus: result.paymentStatus,
      demo: true,
      stockReleased: result.stockReleased === true,
      outcome,
    });
  } catch (error) {
    console.error('[POST /api/payments/demo] Demo payment failed:', error);
    return jsonError('Unable to process the demo payment outcome.', 500);
  }
}

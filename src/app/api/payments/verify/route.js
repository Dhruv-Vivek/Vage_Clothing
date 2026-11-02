import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { getRazorpay, verifyCheckoutSignature } from '@/lib/razorpay';
import {
  markRazorpayPaymentCaptured,
} from '@/lib/order-payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return jsonError('Please sign in to verify this payment.', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  const orderId = Number(body?.orderId);
  const gatewayOrderId = typeof body?.razorpay_order_id === 'string'
    ? body.razorpay_order_id.trim()
    : '';
  const paymentId = typeof body?.razorpay_payment_id === 'string'
    ? body.razorpay_payment_id.trim()
    : '';
  const signature = typeof body?.razorpay_signature === 'string'
    ? body.razorpay_signature.trim()
    : '';

  if (!Number.isSafeInteger(orderId) || orderId <= 0) return jsonError('Invalid VAGE order ID.');
  if (!/^order_[A-Za-z0-9]+$/.test(gatewayOrderId)) return jsonError('Invalid Razorpay order ID.');
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) return jsonError('Invalid Razorpay payment ID.');
  if (!verifyCheckoutSignature(gatewayOrderId, paymentId, signature)) {
    return jsonError('Razorpay payment signature could not be verified.', 400);
  }

  const pool = getPool();
  const [linkedRows] = await pool.execute(
    `SELECT o.order_id, p.amount
     FROM order_payment_gateways g
     INNER JOIN payments p ON p.payment_id = g.payment_id
     INNER JOIN orders o ON o.order_id = p.order_id
     WHERE o.order_id = ?
       AND o.user_id = ?
       AND g.gateway_order_id = ?
     LIMIT 1`,
    [orderId, user.id, gatewayOrderId]
  );

  if (!linkedRows.length) return jsonError('This payment does not belong to your order.', 404);

  try {
    const payment = await getRazorpay().payments.fetch(paymentId);

    if (payment.order_id !== gatewayOrderId) {
      return jsonError('The payment is not linked to this Razorpay order.', 400);
    }

    if (
      Number(payment.amount) !== Math.round(Number(linkedRows[0].amount) * 100) ||
      payment.currency !== 'INR'
    ) {
      return jsonError('Payment amount or currency does not match this order.', 400);
    }

    if (payment.status === 'failed') {
      return jsonError('This payment attempt failed. You may retry in Razorpay Checkout; your order remains pending until the checkout session is closed or reconciled.', 402);
    }

    if (payment.status === 'authorized') {
      const { markRazorpayPaymentAuthorized } = await import('@/lib/order-payments');
      await markRazorpayPaymentAuthorized({
        gatewayOrderId,
        gatewayPaymentId: paymentId,
      });
      return NextResponse.json(
        {
          paymentStatus: 'PENDING',
          message: 'Your payment is authorised and awaiting capture. The order remains pending until Razorpay confirms capture.',
        },
        { status: 202 }
      );
    }

    if (payment.status !== 'captured' || payment.captured !== true) {
      return NextResponse.json(
        {
          paymentStatus: 'PENDING',
          message: 'Your payment is not captured yet. We will update your order when Razorpay confirms capture.',
        },
        { status: 202 }
      );
    }

    const result = await markRazorpayPaymentCaptured({
      gatewayOrderId,
      gatewayPaymentId: paymentId,
      amount: payment.amount,
      currency: payment.currency,
      signatureVerified: true,
    });

    return NextResponse.json({
      orderId: result.orderId,
      paymentStatus: result.paymentStatus,
      emailDelivery: result.emailResults,
    });
  } catch (error) {
    console.error('[POST /api/payments/verify] Verification failed:', error);
    return jsonError('Unable to verify payment status right now. Please do not pay again; refresh your order status in a moment.', 502);
  }
}

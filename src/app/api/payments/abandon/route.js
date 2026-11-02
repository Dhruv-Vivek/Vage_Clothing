import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getRazorpay } from '@/lib/razorpay';
import {
  markRazorpayPaymentCaptured,
  markRazorpayPaymentFailed,
} from '@/lib/order-payments';

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

  const orderId = Number(body?.orderId);
  const razorpayOrderId = typeof body?.razorpayOrderId === 'string'
    ? body.razorpayOrderId.trim()
    : '';

  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !/^order_[A-Za-z0-9]+$/.test(razorpayOrderId)) {
    return NextResponse.json({ error: 'Invalid checkout reference.' }, { status: 400 });
  }

  const linked = await query(
    `SELECT g.gateway_order_id
     FROM order_payment_gateways g
     INNER JOIN payments p ON p.payment_id = g.payment_id
     INNER JOIN orders o ON o.order_id = p.order_id
     WHERE o.order_id = ? AND o.user_id = ? AND g.gateway_order_id = ?
     LIMIT 1`,
    [orderId, user.id, razorpayOrderId]
  );

  if (!linked.length) return NextResponse.json({ error: 'Checkout reference not found.' }, { status: 404 });

  try {
    const response = await getRazorpay().orders.fetchPayments(razorpayOrderId);
    const payments = response.items || [];
    const captured = payments.find((payment) =>
      payment.order_id === razorpayOrderId && payment.status === 'captured' && payment.captured === true
    );

    if (captured) {
      const result = await markRazorpayPaymentCaptured({
        gatewayOrderId: razorpayOrderId,
        gatewayPaymentId: captured.id,
        amount: captured.amount,
        currency: captured.currency,
        signatureVerified: false,
      });
      return NextResponse.json({ paymentStatus: 'PAID', emailDelivery: result.emailResults });
    }

    const authorised = payments.find((payment) =>
      payment.order_id === razorpayOrderId && payment.status === 'authorized'
    );
    if (authorised) {
      return NextResponse.json({
        paymentStatus: 'PENDING',
        message: 'Payment is authorised and is awaiting capture. The order has not been cancelled.',
      }, { status: 202 });
    }

    const failed = [...payments].reverse().find((payment) =>
      payment.order_id === razorpayOrderId && payment.status === 'failed'
    );
    const result = await markRazorpayPaymentFailed({
      gatewayOrderId: razorpayOrderId,
      gatewayPaymentId: failed?.id || null,
    });
    return NextResponse.json({ paymentStatus: result.paymentStatus, stockReleased: result.stockReleased === true });
  } catch (error) {
    console.error('[POST /api/payments/abandon] Reconciliation failed:', error);
    return NextResponse.json({
      error: 'We could not confirm the payment status yet. Do not retry payment; refresh your order status shortly.',
    }, { status: 502 });
  }
}

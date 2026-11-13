import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getRazorpay, verifyCheckoutSignature } from '@/lib/razorpay';
import {
  fetchCashfreeOrder,
  fetchCashfreePayments,
} from '@/lib/payments/cashfree';
import {
  markGatewayPaymentCaptured,
  markGatewayPaymentPending,
  markGatewayPaymentFailed,
  markRazorpayPaymentAuthorized,
} from '@/lib/order-payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
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
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return jsonError('Invalid VAGE order ID.');
  }

  const linkedRows = await query(
    `SELECT
        o.order_id, o.payment_status, o.status AS order_status,
        p.amount AS payment_amount,
        g.gateway, g.gateway_order_id, g.gateway_payment_id
     FROM orders o
     INNER JOIN payments p ON p.order_id = o.order_id
     INNER JOIN order_payment_gateways g ON g.payment_id = p.payment_id
     WHERE o.order_id = ? AND o.user_id = ?
     LIMIT 1`,
    [orderId, user.id]
  );

  if (!linkedRows.length) return jsonError('This payment does not belong to your order.', 404);
  const linked = linkedRows[0];

  if (linked.payment_status === 'PAID') {
    return NextResponse.json({ orderId, paymentStatus: 'PAID', alreadyFinal: true });
  }

  try {
    if (linked.gateway === 'CASHFREE') {
      const [remoteOrder, paymentResponse] = await Promise.all([
        fetchCashfreeOrder(linked.gateway_order_id),
        fetchCashfreePayments(linked.gateway_order_id),
      ]);

      if (
        remoteOrder.order_id !== linked.gateway_order_id ||
        toCents(remoteOrder.order_amount) !== toCents(linked.payment_amount) ||
        String(remoteOrder.order_currency).toUpperCase() !== 'INR'
      ) {
        return jsonError('Cashfree order reference, amount or currency does not match this VAGE order.', 409);
      }

      const payments = Array.isArray(paymentResponse)
        ? paymentResponse
        : Array.isArray(paymentResponse?.data) ? paymentResponse.data : [];

      const successful = payments.find((payment) =>
        payment.order_id === linked.gateway_order_id &&
        payment.payment_status === 'SUCCESS'
      );

      if (remoteOrder.order_status === 'PAID' && successful) {
        if (
          toCents(successful.payment_amount) !== toCents(linked.payment_amount) ||
          String(successful.payment_currency || remoteOrder.order_currency).toUpperCase() !== 'INR'
        ) {
          return jsonError('Cashfree payment amount or currency does not match the VAGE order.', 409);
        }

        const result = await markGatewayPaymentCaptured({
          gateway: 'CASHFREE',
          gatewayOrderId: linked.gateway_order_id,
          gatewayPaymentId: String(successful.cf_payment_id),
          amount: toCents(successful.payment_amount),
          currency: successful.payment_currency || remoteOrder.order_currency,
          signatureVerified: false,
        });

        return NextResponse.json({
          orderId: result.orderId,
          paymentStatus: result.paymentStatus,
          paymentProvider: 'CASHFREE',
          emailDelivery: result.emailResults,
        });
      }

      const terminalAttempts = payments.length > 0 && payments.every((payment) =>
        ['FAILED', 'USER_DROPPED', 'CANCELLED'].includes(String(payment.payment_status || '').toUpperCase())
      );

      if (terminalAttempts || remoteOrder.order_status === 'EXPIRED') {
        const latestAttempt = payments[payments.length - 1];
        const failedResult = await markGatewayPaymentFailed({
          gateway: 'CASHFREE',
          gatewayOrderId: linked.gateway_order_id,
          gatewayPaymentId: latestAttempt?.cf_payment_id
            ? String(latestAttempt.cf_payment_id)
            : null,
        });
        return NextResponse.json({
          orderId,
          paymentStatus: failedResult.paymentStatus,
          paymentProvider: 'CASHFREE',
          message: 'Cashfree did not complete the payment. The unpaid VAGE order was cancelled and reserved stock was released.',
        });
      }

      await markGatewayPaymentPending({
        gateway: 'CASHFREE',
        gatewayOrderId: linked.gateway_order_id,
      });

      return NextResponse.json({
        orderId,
        paymentStatus: 'PENDING',
        paymentProvider: 'CASHFREE',
        message: 'Cashfree has not confirmed a successful payment yet. The VAGE order remains pending.',
      }, { status: 202 });
    }

    if (linked.gateway === 'RAZORPAY') {
      const gatewayOrderId = typeof body?.razorpay_order_id === 'string'
        ? body.razorpay_order_id.trim()
        : '';
      const paymentId = typeof body?.razorpay_payment_id === 'string'
        ? body.razorpay_payment_id.trim()
        : '';
      const signature = typeof body?.razorpay_signature === 'string'
        ? body.razorpay_signature.trim()
        : '';

      if (
        gatewayOrderId !== linked.gateway_order_id ||
        !/^order_[A-Za-z0-9]+$/.test(gatewayOrderId) ||
        !/^pay_[A-Za-z0-9]+$/.test(paymentId)
      ) {
        return jsonError('Invalid Razorpay checkout reference.');
      }
      if (!verifyCheckoutSignature(gatewayOrderId, paymentId, signature)) {
        return jsonError('Razorpay payment signature could not be verified.', 400);
      }

      const payment = await getRazorpay().payments.fetch(paymentId);
      if (payment.order_id !== gatewayOrderId) {
        return jsonError('The payment is not linked to this Razorpay order.', 400);
      }
      // Razorpay's payment.amount is already in paise; MySQL stores INR decimal.
      // Convert only the MySQL amount. Multiplying Razorpay's paise by 100 again
      // caused valid captured payments to fail the amount comparison.
      const razorpayAmountPaise = Number(payment.amount);
      const orderAmountPaise = toCents(linked.payment_amount);
      if (
        !Number.isSafeInteger(razorpayAmountPaise) ||
        razorpayAmountPaise !== orderAmountPaise ||
        payment.currency !== 'INR'
      ) {
        return jsonError('Payment amount or currency does not match this order.', 400);
      }

      if (payment.status === 'authorized') {
        await markRazorpayPaymentAuthorized({
          gatewayOrderId,
          gatewayPaymentId: paymentId,
        });
        return NextResponse.json({
          paymentStatus: 'PENDING',
          message: 'Your payment is authorised and awaiting capture.',
        }, { status: 202 });
      }

      if (payment.status !== 'captured' || payment.captured !== true) {
        return NextResponse.json({
          paymentStatus: 'PENDING',
          message: 'Razorpay has not confirmed a captured payment yet.',
        }, { status: 202 });
      }

      const result = await markGatewayPaymentCaptured({
        gateway: 'RAZORPAY',
        gatewayOrderId,
        gatewayPaymentId: paymentId,
        amount: payment.amount,
        currency: payment.currency,
        signatureVerified: true,
      });
      return NextResponse.json({
        orderId: result.orderId,
        paymentStatus: result.paymentStatus,
        paymentProvider: 'RAZORPAY',
        emailDelivery: result.emailResults,
      });
    }

    if (linked.gateway === 'DEMO') {
      return jsonError('Use the demo payment simulator to select an outcome.', 409);
    }

    return jsonError('Unsupported payment provider for this order.', 409);
  } catch (error) {
    console.error('[POST /api/payments/verify] Verification failed:', error);
    return jsonError(
      'Unable to verify payment status right now. Do not pay again; refresh your order status in a moment.',
      502
    );
  }
}

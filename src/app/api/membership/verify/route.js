import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRazorpay, verifyCheckoutSignature } from '@/lib/razorpay';
import {
  getMembershipPurchaseOwner,
  markMembershipPurchaseAuthorized,
  markMembershipPurchaseCaptured,
} from '@/lib/membership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to verify this membership payment.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const purchaseId = Number(body?.purchaseId);
  const gatewayOrderId = String(body?.razorpay_order_id || '').trim();
  const paymentId = String(body?.razorpay_payment_id || '').trim();
  const signature = String(body?.razorpay_signature || '').trim();

  if (!Number.isSafeInteger(purchaseId) || purchaseId <= 0) {
    return NextResponse.json({ error: 'Invalid membership purchase ID.' }, { status: 400 });
  }
  if (!/^order_[A-Za-z0-9]+$/.test(gatewayOrderId) || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    return NextResponse.json({ error: 'Invalid Razorpay payment references.' }, { status: 400 });
  }
  if (!verifyCheckoutSignature(gatewayOrderId, paymentId, signature)) {
    return NextResponse.json({ error: 'Razorpay payment signature could not be verified.' }, { status: 400 });
  }

  const purchase = await getMembershipPurchaseOwner(user.id, purchaseId);
  if (!purchase || purchase.gateway_order_id !== gatewayOrderId) {
    return NextResponse.json({ error: 'This payment does not belong to your membership purchase.' }, { status: 404 });
  }
  if (purchase.status === 'CAPTURED') {
    return NextResponse.json({ purchaseId, paymentStatus: 'PAID', alreadyFinal: true });
  }

  try {
    const payment = await getRazorpay().payments.fetch(paymentId);
    if (payment.order_id !== gatewayOrderId) {
      return NextResponse.json({ error: 'Payment is not linked to this Razorpay order.' }, { status: 400 });
    }
    if (Number(payment.amount) !== Math.round(Number(purchase.amount) * 100) || payment.currency !== 'INR') {
      return NextResponse.json({ error: 'Payment amount or currency does not match the membership plan.' }, { status: 400 });
    }
    if (payment.status === 'authorized') {
      await markMembershipPurchaseAuthorized({ purchaseId, gatewayPaymentId: paymentId });
      return NextResponse.json({
        purchaseId,
        paymentStatus: 'PENDING',
        message: 'Payment is authorised and awaiting capture. Membership benefits have not been activated yet.',
      }, { status: 202 });
    }
    if (payment.status !== 'captured' || payment.captured !== true) {
      return NextResponse.json({
        purchaseId,
        paymentStatus: 'PENDING',
        message: 'Payment has not been captured yet. Membership benefits will activate after capture is confirmed.',
      }, { status: 202 });
    }

    const result = await markMembershipPurchaseCaptured({
      purchaseId,
      gatewayOrderId,
      gatewayPaymentId: paymentId,
      amount: payment.amount,
      currency: payment.currency,
      signatureVerified: true,
    });
    return NextResponse.json({ purchaseId, paymentStatus: 'PAID', activated: result.activated });
  } catch (error) {
    console.error('[POST /api/membership/verify] Failed:', error);
    return NextResponse.json({ error: 'Unable to verify membership payment right now. Do not pay again; refresh your membership page shortly.' }, { status: 502 });
  }
}

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRazorpay } from '@/lib/razorpay';
import {
  getMembershipPurchaseOwner,
  markMembershipPurchaseAuthorized,
  markMembershipPurchaseCaptured,
  markMembershipPurchaseFailed,
} from '@/lib/membership';

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

  const purchaseId = Number(body?.purchaseId);
  if (!Number.isSafeInteger(purchaseId) || purchaseId <= 0) {
    return NextResponse.json({ error: 'Invalid membership purchase ID.' }, { status: 400 });
  }

  const purchase = await getMembershipPurchaseOwner(user.id, purchaseId);
  if (!purchase || !purchase.gateway_order_id) {
    return NextResponse.json({ error: 'Membership payment session was not found.' }, { status: 404 });
  }
  if (purchase.status === 'CAPTURED') {
    return NextResponse.json({ purchaseId, paymentStatus: 'PAID', activated: true });
  }

  try {
    const response = await getRazorpay().orders.fetchPayments(purchase.gateway_order_id);
    const payments = response.items || [];
    const captured = payments.find((item) => item.order_id === purchase.gateway_order_id && item.status === 'captured' && item.captured === true);
    if (captured) {
      await markMembershipPurchaseCaptured({
        purchaseId,
        gatewayOrderId: purchase.gateway_order_id,
        gatewayPaymentId: captured.id,
        amount: captured.amount,
        currency: captured.currency,
        signatureVerified: false,
      });
      return NextResponse.json({ purchaseId, paymentStatus: 'PAID', activated: true });
    }

    const authorised = payments.find((item) => item.order_id === purchase.gateway_order_id && item.status === 'authorized');
    if (authorised) {
      await markMembershipPurchaseAuthorized({ purchaseId, gatewayPaymentId: authorised.id });
      return NextResponse.json({ purchaseId, paymentStatus: 'PENDING', message: 'Payment is authorised and awaiting capture.' });
    }

    await markMembershipPurchaseFailed(purchaseId);
    return NextResponse.json({ purchaseId, paymentStatus: 'FAILED', message: 'Membership checkout was closed before capture. No membership was activated.' });
  } catch (error) {
    console.error('[POST /api/membership/abandon] Reconciliation failed:', error);
    return NextResponse.json({ error: 'Unable to reconcile this membership payment yet. Refresh membership status before trying again.' }, { status: 502 });
  }
}

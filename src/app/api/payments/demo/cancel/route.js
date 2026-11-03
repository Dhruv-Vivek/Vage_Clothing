import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { isDemoPaymentsEnabled } from '@/lib/payments/config';
import { markGatewayPaymentFailed } from '@/lib/order-payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!isDemoPaymentsEnabled() || process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Demo payments are disabled.' }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const orderId = Number(body?.orderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: 'Invalid order reference.' }, { status: 400 });
  }

  try {
    const rows = await query(
      `SELECT g.gateway_order_id, o.payment_status, o.status AS order_status
       FROM orders o
       INNER JOIN payments p ON p.order_id = o.order_id
       INNER JOIN order_payment_gateways g ON g.payment_id = p.payment_id
       WHERE o.order_id = ? AND o.user_id = ? AND g.gateway = 'DEMO'
       LIMIT 1`,
      [orderId, user.id]
    );

    if (!rows.length) {
      return NextResponse.json({ error: 'Demo order was not found for this account.' }, { status: 404 });
    }

    if (rows[0].payment_status === 'PAID') {
      return NextResponse.json({ error: 'A paid order cannot be cancelled from checkout.' }, { status: 409 });
    }

    if (rows[0].order_status === 'CANCELLED') {
      return NextResponse.json({ success: true, paymentStatus: rows[0].payment_status });
    }

    const result = await markGatewayPaymentFailed({
      gateway: 'DEMO',
      gatewayOrderId: rows[0].gateway_order_id,
      gatewayPaymentId: null,
    });

    return NextResponse.json({
      success: true,
      orderId,
      paymentStatus: result.paymentStatus,
      stockReleased: result.stockReleased === true,
    });
  } catch (error) {
    console.error('[POST /api/payments/demo/cancel] Failed:', error);
    return NextResponse.json({ error: 'Unable to cancel the demo checkout.' }, { status: 500 });
  }
}

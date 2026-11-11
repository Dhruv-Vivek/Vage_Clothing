// EMBEDDED MYSQL: this route reads cart, variant, coupon and membership pricing using transaction-bound SQL queries; the quote is not the final checkout commit.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { HttpError } from '@/lib/guards';
import { priceCheckout } from '@/lib/checkout-pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to calculate checkout.' }, { status: 401 });
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > 20) {
    return NextResponse.json({ error: 'Your cart must contain between 1 and 20 variants.' }, { status: 422 });
  }
  const items = body.items.map((item) => ({ variantId: Number(item?.variantId), quantity: Number(item?.quantity) }));
  if (items.some((item) => !Number.isSafeInteger(item.variantId) || item.variantId <= 0 ||
      !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) ||
      new Set(items.map((item) => item.variantId)).size !== items.length) {
    return NextResponse.json({ error: 'Your cart contains an invalid or duplicate variant.' }, { status: 422 });
  }

  const connection = await getPool().getConnection();
  try {
    const quote = await priceCheckout(connection, {
      userId: user.id, items, deliveryMethod: body.deliveryMethod,
      couponCode: typeof body.couponCode === 'string' ? body.couponCode.slice(0, 40) : '',
      lock: false, strictCoupon: false,
    });
    return NextResponse.json({
      currency: 'INR',
      quote: {
        subtotalCents: quote.subtotalCents,
        membershipDiscountCents: quote.membershipDiscountCents,
        couponDiscountCents: quote.couponDiscountCents,
        discountCents: quote.discountCents,
        shippingCents: quote.shippingCents,
        shippingIsFree: quote.shippingIsFree,
        totalCents: quote.totalCents,
        membership: quote.membership,
        coupon: quote.coupon,
        couponError: quote.couponError,
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error('[POST /api/checkout/quote]', error);
    return NextResponse.json({ error: status === 500 ? 'Unable to calculate checkout estimate.' : error.message }, { status });
  } finally {
    connection.release();
  }
}

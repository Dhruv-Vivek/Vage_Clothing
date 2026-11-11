// EMBEDDED MYSQL: coupon validation reads the coupon and cart data with parameterized SELECT statements; final discount checks run again inside checkout.
import { query } from '@/lib/db';
import { userRoute } from '@/lib/api';
import { loadCart } from '@/lib/cart';
import { HttpError, cleanText, readJson } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Preview a coupon against the customer's current cart. This only tells the checkout page what to
 * display; the place_order procedure re-checks everything (and locks the coupon) when the order is placed.
 */
export const POST = userRoute(async ({ request, user }) => {
  const body = await readJson(request);
  const code = (cleanText(body.code, { label: 'Coupon code', max: 40, required: true }) || '').toUpperCase();

  const cart = await loadCart(user.id);
  if (cart.items.length === 0) throw new HttpError(400, 'Your cart is empty.');

  const [coupon] = await query('SELECT * FROM coupons WHERE coupon_code = ? LIMIT 1', [code]);
  if (!coupon) throw new HttpError(404, 'That coupon code is not valid.');

  const now = new Date();
  if (!coupon.is_active || new Date(coupon.starts_at) > now || new Date(coupon.expires_at) <= now) {
    throw new HttpError(400, 'This coupon is not active right now.');
  }
  if (coupon.usage_limit !== null && Number(coupon.usage_count) >= Number(coupon.usage_limit)) {
    throw new HttpError(400, 'This coupon has been fully used.');
  }
  const minimum = Number(coupon.min_order_amount);
  if (cart.subtotal < minimum) {
    throw new HttpError(400, `Add ₹${Math.ceil(minimum - cart.subtotal).toLocaleString('en-IN')} more to use this coupon.`);
  }

  let discount;
  if (coupon.discount_type === 'PERCENT') {
    discount = Math.round(cart.subtotal * Number(coupon.discount_value)) / 100;
    if (coupon.max_discount !== null) discount = Math.min(discount, Number(coupon.max_discount));
  } else {
    discount = Math.min(Number(coupon.discount_value), cart.subtotal);
  }
  discount = Math.min(Math.round(discount * 100) / 100, cart.subtotal);

  return { code: coupon.coupon_code, discount, subtotal: cart.subtotal };
});

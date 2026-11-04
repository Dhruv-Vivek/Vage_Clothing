import { query } from '@/lib/db';
import { userRoute } from '@/lib/api';
import { MAX_LINE_QUANTITY, loadCart } from '@/lib/cart';
import { HttpError, cleanInt, readJson, toId } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LATEST_CART = `(SELECT MAX(cart_id) FROM carts WHERE user_id = ? AND status = 'ACTIVE')`;

/** Set a line's quantity (0 removes it). */
export const PATCH = userRoute(async ({ request, params, user }) => {
  const variantId = toId(params.variantId, 'Variant');
  const body = await readJson(request);
  const quantity = cleanInt(body.quantity, 'Quantity', { min: 0, max: MAX_LINE_QUANTITY });

  const [line] = await query(
    `SELECT ci.cart_item_id, COALESCE(i.stock_quantity, 0) AS stock
       FROM cart_items AS ci
       LEFT JOIN inventory AS i ON i.variant_id = ci.variant_id
      WHERE ci.cart_id = ${LATEST_CART} AND ci.variant_id = ?`,
    [user.id, variantId]
  );
  if (!line) throw new HttpError(404, 'That item is not in your cart.');

  if (quantity === 0) {
    await query('DELETE FROM cart_items WHERE cart_item_id = ?', [line.cart_item_id]);
  } else {
    if (quantity > Number(line.stock)) {
      throw new HttpError(409, Number(line.stock) === 0 ? 'This item is out of stock.' : `Only ${line.stock} left in stock.`);
    }
    await query('UPDATE cart_items SET quantity = ? WHERE cart_item_id = ?', [quantity, line.cart_item_id]);
  }
  return loadCart(user.id);
});

export const DELETE = userRoute(async ({ params, user }) => {
  const variantId = toId(params.variantId, 'Variant');
  await query(
    `DELETE FROM cart_items WHERE cart_id = ${LATEST_CART} AND variant_id = ?`,
    [user.id, variantId]
  );
  return loadCart(user.id);
});

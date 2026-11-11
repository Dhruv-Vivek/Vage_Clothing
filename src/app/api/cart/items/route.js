// EMBEDDED MYSQL: cart-item creation uses server-side SELECT/INSERT/UPDATE statements and checks current product stock.
import { userRoute } from '@/lib/api';
import { MAX_LINE_QUANTITY, loadCart } from '@/lib/cart';
import { HttpError, cleanInt, readJson, run, toId, withTransaction } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Add a size/colour (variant) to the signed-in customer's database cart. Adding the same variant again increases its quantity. */
export const POST = userRoute(async ({ request, user }) => {
  const body = await readJson(request);
  const variantId = toId(body.variantId, 'Variant');
  const quantity = body.quantity === undefined ? 1 : cleanInt(body.quantity, 'Quantity', { min: 1, max: MAX_LINE_QUANTITY });

  await withTransaction(async (connection) => {
    // Serialise cart creation per customer so two quick clicks cannot create two active carts.
    await run(connection, 'SELECT user_id FROM users WHERE user_id = ? FOR UPDATE', [user.id]);

    let [cart] = await run(
      connection,
      "SELECT cart_id FROM carts WHERE user_id = ? AND status = 'ACTIVE' ORDER BY cart_id DESC LIMIT 1",
      [user.id]
    );
    if (!cart) {
      const created = await run(connection, "INSERT INTO carts (user_id, status) VALUES (?, 'ACTIVE')", [user.id]);
      cart = { cart_id: created.insertId };
    }

    const [variant] = await run(
      connection,
      `SELECT COALESCE(i.stock_quantity, 0) AS stock
         FROM product_variants AS pv
         JOIN products AS p ON p.product_id = pv.product_id
         LEFT JOIN inventory AS i ON i.variant_id = pv.variant_id
        WHERE pv.variant_id = ? AND pv.is_active = 1 AND p.status = 'ACTIVE'`,
      [variantId]
    );
    if (!variant) throw new HttpError(404, 'This item is no longer available.');

    const stock = Number(variant.stock);
    if (stock <= 0) throw new HttpError(409, 'Sorry, this size and colour is out of stock.');

    const [existing] = await run(
      connection,
      'SELECT quantity FROM cart_items WHERE cart_id = ? AND variant_id = ? FOR UPDATE',
      [cart.cart_id, variantId]
    );
    const inCart = existing ? Number(existing.quantity) : 0;
    const wanted = inCart + quantity;

    if (wanted > stock) {
      throw new HttpError(
        409,
        inCart > 0
          ? `Only ${stock} in stock, and you already have ${inCart} in your cart.`
          : `Only ${stock} left in stock.`
      );
    }
    if (wanted > MAX_LINE_QUANTITY) {
      throw new HttpError(400, `You can order up to ${MAX_LINE_QUANTITY} of one item at a time.`);
    }

    if (existing) {
      await run(connection, 'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND variant_id = ?', [
        wanted,
        cart.cart_id,
        variantId,
      ]);
    } else {
      await run(connection, 'INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (?, ?, ?)', [
        cart.cart_id,
        variantId,
        wanted,
      ]);
    }
  });

  return loadCart(user.id);
});

import 'server-only';

import { query } from '@/lib/db';
import { inr } from '@/lib/format';

export const MAX_LINE_QUANTITY = 10;

/** The cart place_order will use: the customer's most recent ACTIVE cart. */
const LATEST_CART = `(SELECT MAX(cart_id) FROM carts WHERE user_id = ? AND status = 'ACTIVE')`;

export async function loadCart(userId) {
  const rows = await query(
    `SELECT ci.variant_id, ci.quantity,
            pv.sku, pv.size, pv.color, pv.is_active AS variant_active,
            p.product_id, p.name, p.image_url, p.status AS product_status,
            c.name AS category,
            COALESCE(pv.price_override, p.base_price) AS unit_price,
            COALESCE(i.stock_quantity, 0) AS stock
       FROM cart_items AS ci
       JOIN product_variants AS pv ON pv.variant_id = ci.variant_id
       JOIN products AS p ON p.product_id = pv.product_id
       JOIN categories AS c ON c.category_id = p.category_id
       LEFT JOIN inventory AS i ON i.variant_id = pv.variant_id
      WHERE ci.cart_id = ${LATEST_CART}
      ORDER BY ci.added_at ASC, ci.cart_item_id ASC`,
    [userId]
  );

  let subtotal = 0;
  let count = 0;
  let hasIssues = false;

  const items = rows.map((row) => {
    const unitPrice = Number(row.unit_price);
    const quantity = Number(row.quantity);
    const stock = Number(row.stock);

    let issue = null;
    if (!row.variant_active || row.product_status !== 'ACTIVE') issue = 'No longer available';
    else if (stock === 0) issue = 'Out of stock';
    else if (stock < quantity) issue = `Only ${stock} left`;
    if (issue) hasIssues = true;

    subtotal += unitPrice * quantity;
    count += quantity;

    return {
      id: Number(row.variant_id), // the cart is keyed by variant
      variantId: Number(row.variant_id),
      productId: Number(row.product_id),
      name: row.name,
      category: row.category,
      image: row.image_url || null,
      size: row.size,
      color: row.color,
      sku: row.sku,
      unitPrice,
      price: inr(unitPrice, 2),
      quantity,
      lineTotal: Math.round(unitPrice * quantity * 100) / 100,
      stock,
      issue,
    };
  });

  return { items, subtotal: Math.round(subtotal * 100) / 100, count, hasIssues };
}

import { query } from '@/lib/db';
import { HttpError, adminRoute, readJson, toId } from '@/lib/admin';
import { loadProduct, parseProductBody } from '@/lib/admin-products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = adminRoute(async ({ params }) => {
  const result = await loadProduct(toId(params.id, 'Product ID'));
  if (!result) throw new HttpError(404, 'Product not found.');
  return result;
});

export const PATCH = adminRoute(async ({ request, params }) => {
  const productId = toId(params.id, 'Product ID');
  const fields = parseProductBody(await readJson(request), { partial: true });
  const columns = Object.keys(fields); // keys come from parseProductBody, never from the request
  if (!columns.length) throw new HttpError(400, 'Nothing to update.');

  const existing = await query('SELECT 1 FROM products WHERE product_id = ? LIMIT 1', [productId]);
  if (!existing.length) throw new HttpError(404, 'Product not found.');

  await query(
    `UPDATE products SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE product_id = ?`,
    [...columns.map((c) => fields[c]), productId]
  );
  return loadProduct(productId);
});

/**
 * "Delete" archives the product. Real deletion is blocked by design: order history and
 * variants reference products, and the storefront only lists ACTIVE items, so archiving
 * hides it everywhere without breaking past orders.
 */
export const DELETE = adminRoute(async ({ params }) => {
  const productId = toId(params.id, 'Product ID');
  const existing = await query('SELECT 1 FROM products WHERE product_id = ? LIMIT 1', [productId]);
  if (!existing.length) throw new HttpError(404, 'Product not found.');
  await query("UPDATE products SET status = 'ARCHIVED' WHERE product_id = ?", [productId]);
  return { archived: true, id: productId };
});

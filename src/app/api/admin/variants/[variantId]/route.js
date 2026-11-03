import { query } from '@/lib/db';
import { HttpError, adminRoute, cleanMoney, cleanText, readJson, toId } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Edit a variant's size, colour, SKU, price override or active flag.
 * Variants are deactivated rather than deleted because carts and past orders reference them.
 */
export const PATCH = adminRoute(async ({ request, params }) => {
  const variantId = toId(params.variantId, 'Variant ID');
  const body = await readJson(request);
  const has = (key) => body[key] !== undefined;
  const fields = {};

  if (has('size')) fields.size = cleanText(body.size, { label: 'Size', max: 32, required: true });
  if (has('color')) fields.color = cleanText(body.color, { label: 'Colour', max: 64, required: true });
  if (has('sku')) {
    const sku = cleanText(body.sku, { label: 'SKU', max: 64, required: true });
    if (!/^[A-Za-z0-9._-]+$/.test(sku)) {
      throw new HttpError(400, 'SKU may only contain letters, numbers, dots, dashes and underscores.');
    }
    fields.sku = sku;
  }
  if (has('priceOverride')) {
    fields.price_override = cleanMoney(body.priceOverride, 'Price override', { nullable: true });
  }
  if (has('isActive')) {
    if (typeof body.isActive !== 'boolean') throw new HttpError(400, 'isActive must be true or false.');
    fields.is_active = body.isActive ? 1 : 0;
  }

  const columns = Object.keys(fields);
  if (!columns.length) throw new HttpError(400, 'Nothing to update.');

  const existing = await query('SELECT 1 FROM product_variants WHERE variant_id = ? LIMIT 1', [variantId]);
  if (!existing.length) throw new HttpError(404, 'Variant not found.');

  await query(
    `UPDATE product_variants SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE variant_id = ?`,
    [...columns.map((c) => fields[c]), variantId]
  );
  return { updated: true, variantId };
});

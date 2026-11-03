import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { HttpError, adminRoute, readJson, toId, withTransaction } from '@/lib/admin';
import { insertVariant, parseVariantBody } from '@/lib/admin-products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = adminRoute(async ({ request, params, user }) => {
  const productId = toId(params.id, 'Product ID');
  const input = parseVariantBody(await readJson(request));

  const exists = await query('SELECT 1 FROM products WHERE product_id = ? LIMIT 1', [productId]);
  if (!exists.length) throw new HttpError(404, 'Product not found.');

  const { variantId, sku } = await withTransaction((connection) =>
    insertVariant(connection, productId, input, user.id)
  );

  return NextResponse.json(
    {
      variant: {
        variantId,
        sku,
        size: input.size,
        color: input.color,
        priceOverride: input.priceOverride,
        isActive: true,
        stock: input.stock,
      },
    },
    { status: 201 }
  );
});

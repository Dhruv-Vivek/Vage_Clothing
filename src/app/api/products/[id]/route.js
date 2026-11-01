import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapProduct(row) {
  const price = Number(row.base_price);
  const stock = Number(row.total_stock || 0);

  return {
    id: Number(row.product_id),
    productId: Number(row.product_id),
    categoryId: Number(row.category_id),
    category: row.category_name,
    categorySlug: row.category_slug,
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    description: row.description || '',
    basePrice: price,
    price: new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(price),
    image: row.image_url || null,
    imageUrl: row.image_url || null,
    status: row.status,
    specs: {
      material: row.material || 'Not specified',
      fit: row.fit_type || 'Not specified',
      origin: row.product_origin || 'Not specified',
    },
    variantCount: Number(row.variant_count || 0),
    availableStock: stock,
    inStock: stock > 0,
  };
}

export async function GET(_request, context) {
  try {
    const { id: rawId } = await context.params;
    if (!/^\d+$/.test(String(rawId))) {
      return NextResponse.json({ error: 'Invalid product ID.' }, { status: 400 });
    }

    const productId = Number(rawId);
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      return NextResponse.json({ error: 'Invalid product ID.' }, { status: 400 });
    }

    const rows = await query(
      `SELECT vc.*, c.slug AS category_slug
       FROM v_product_catalog AS vc
       INNER JOIN products AS p ON p.product_id = vc.product_id
       INNER JOIN categories AS c ON c.category_id = vc.category_id
       WHERE vc.product_id = ?
         AND vc.status = 'ACTIVE'
         AND c.is_active = 1
       LIMIT 1`,
      [productId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    const product = mapProduct(rows[0]);
    const variantRows = await query(
      `SELECT
         pv.variant_id,
         pv.sku,
         pv.size,
         pv.color,
         COALESCE(pv.price_override, p.base_price) AS unit_price,
         COALESCE(i.stock_quantity, 0) AS stock_quantity
       FROM product_variants AS pv
       INNER JOIN products AS p ON p.product_id = pv.product_id
       LEFT JOIN inventory AS i ON i.variant_id = pv.variant_id
       WHERE pv.product_id = ?
         AND pv.is_active = 1
       ORDER BY pv.color ASC, pv.size ASC`,
      [productId]
    );

    const variants = variantRows.map((variant) => ({
      variantId: Number(variant.variant_id),
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      unitPrice: Number(variant.unit_price),
      stockQuantity: Number(variant.stock_quantity),
      inStock: Number(variant.stock_quantity) > 0,
    }));

    return NextResponse.json(
      { product, variants },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('[GET /api/products/:id] MySQL query failed:', error);
    return NextResponse.json(
      { error: 'Unable to load this product.' },
      { status: 500 }
    );
  }
}

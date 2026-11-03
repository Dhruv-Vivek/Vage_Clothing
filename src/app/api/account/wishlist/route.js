import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapProduct(row) {
  const price = Number(row.base_price);
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
    price: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(price),
    image: row.image_url || null,
    imageUrl: row.image_url || null,
    availableStock: Number(row.total_stock || 0),
    inStock: Number(row.total_stock || 0) > 0,
    createdAt: row.saved_at,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  try {
    const [rows] = await getPool().execute(
      'SELECT vc.product_id, vc.category_id, vc.category_name, c.slug AS category_slug, ' +
      'vc.name, vc.slug, vc.brand, vc.description, vc.base_price, vc.image_url, vc.total_stock, wi.created_at AS saved_at ' +
      'FROM wishlist_items wi INNER JOIN v_product_catalog vc ON vc.product_id = wi.product_id ' +
      'INNER JOIN categories c ON c.category_id = vc.category_id ' +
      'WHERE wi.user_id = ? AND vc.status = ? AND c.is_active = 1 ORDER BY wi.created_at DESC',
      [user.id, 'ACTIVE']
    );
    return NextResponse.json({ products: rows.map(mapProduct) }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('[GET /api/account/wishlist] Failed:', error);
    return NextResponse.json({ error: 'Unable to load your wishlist.' }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const rawIds = Array.isArray(body?.productIds) ? body.productIds : [body?.productId];
  const ids = [...new Set(rawIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!ids.length || ids.length > 100) {
    return NextResponse.json({ error: 'Provide between 1 and 100 valid product IDs.' }, { status: 400 });
  }

  try {
    const placeholders = ids.map(() => '?').join(',');
    const [result] = await getPool().execute(
      'INSERT IGNORE INTO wishlist_items (user_id, product_id) ' +
      'SELECT ?, product_id FROM products WHERE product_id IN (' + placeholders + ') AND status = ?',
      [user.id, ...ids, 'ACTIVE']
    );
    return NextResponse.json({ saved: true, added: result.affectedRows });
  } catch (error) {
    console.error('[POST /api/account/wishlist] Failed:', error);
    return NextResponse.json({ error: 'Unable to update your wishlist.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const productId = Number(searchParams.get('productId'));
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return NextResponse.json({ error: 'A valid product ID is required.' }, { status: 400 });
  }

  try {
    const [result] = await getPool().execute(
      'DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?',
      [user.id, productId]
    );
    return NextResponse.json({ removed: result.affectedRows > 0 });
  } catch (error) {
    console.error('[DELETE /api/account/wishlist] Failed:', error);
    return NextResponse.json({ error: 'Unable to remove this product from your wishlist.' }, { status: 500 });
  }
}

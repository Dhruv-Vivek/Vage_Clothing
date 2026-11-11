// EMBEDDED MYSQL: this route uses parameterized SELECT statements and a correlated subquery to build the signed-in customer's order history.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1));
  const limit = Math.min(20, Math.max(1, Math.floor(Number(params.get('limit')) || 10)));
  const offset = (page - 1) * limit;

  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT o.order_id, o.order_number, o.status, o.payment_status, o.total_amount, o.created_at, ' +
      '(SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.order_id) AS item_count, ' +
      '(SELECT p.image_url FROM order_items oi INNER JOIN product_variants pv ON pv.variant_id = oi.variant_id ' +
      'INNER JOIN products p ON p.product_id = pv.product_id WHERE oi.order_id = o.order_id ORDER BY oi.order_item_id LIMIT 1) AS preview_image ' +
      'FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC, o.order_id DESC LIMIT ? OFFSET ?',
      [user.id, limit, offset]
    );
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) AS total FROM orders WHERE user_id = ?',
      [user.id]
    );
    const total = Number(countRows[0]?.total || 0);
    return NextResponse.json({
      orders: rows.map((row) => ({
        orderId: Number(row.order_id),
        orderNumber: row.order_number,
        status: row.status,
        paymentStatus: row.payment_status,
        totalAmount: Number(row.total_amount),
        itemCount: Number(row.item_count || 0),
        previewImage: row.preview_image || null,
        createdAt: row.created_at,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: offset + rows.length < total },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('[GET /api/account/orders] Failed:', error);
    return NextResponse.json({ error: 'Unable to load your order history.' }, { status: 500 });
  }
}

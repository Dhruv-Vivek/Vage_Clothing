import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getAdminAccess } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDER_STATUSES = new Set([
  'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED',
  'DELIVERED', 'CANCELLED', 'RETURNED',
]);
const PAYMENT_STATUSES = new Set(['PENDING', 'PAID', 'FAILED', 'REFUNDED']);

export async function GET(request) {
  const access = await getAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  const pageSize = Math.max(10, Math.min(50, Number.parseInt(params.get('pageSize') || '20', 10) || 20));
  const search = String(params.get('q') || '').trim().slice(0, 100);
  const status = String(params.get('status') || '').trim().toUpperCase();
  const paymentStatus = String(params.get('paymentStatus') || '').trim().toUpperCase();

  if (status && !ORDER_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid order status filter.' }, { status: 400 });
  }
  if (paymentStatus && !PAYMENT_STATUSES.has(paymentStatus)) {
    return NextResponse.json({ error: 'Invalid payment status filter.' }, { status: 400 });
  }

  const where = [];
  const values = [];
  if (status) {
    where.push('o.status = ?');
    values.push(status);
  }
  if (paymentStatus) {
    where.push('o.payment_status = ?');
    values.push(paymentStatus);
  }
  if (search) {
    where.push('(o.order_number LIKE ? OR u.full_name LIKE ? OR COALESCE(NULLIF(o.contact_email, \'\'), u.email) LIKE ?)');
    const pattern = '%' + search + '%';
    values.push(pattern, pattern, pattern);
  }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (page - 1) * pageSize;

  try {
    const pool = getPool();
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) AS total ' +
      'FROM orders o INNER JOIN users u ON u.user_id = o.user_id ' + whereSql,
      values
    );
    const [orders] = await pool.execute(
      'SELECT o.order_id, o.order_number, o.status, o.payment_status, ' +
      'o.subtotal, o.discount_amount, o.shipping_amount, o.total_amount, ' +
      'o.created_at, o.updated_at, u.full_name AS customer_name, ' +
      'COALESCE(NULLIF(o.contact_email, \'\'), u.email) AS customer_email, ' +
      '(SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.order_id) AS item_count, ' +
      '(SELECT p.payment_method FROM payments p WHERE p.order_id = o.order_id ' +
      'ORDER BY p.payment_id DESC LIMIT 1) AS payment_method ' +
      'FROM orders o INNER JOIN users u ON u.user_id = o.user_id ' +
      whereSql +
      ' ORDER BY o.created_at DESC, o.order_id DESC LIMIT ? OFFSET ?',
      [...values, pageSize, offset]
    );

    const total = Number(countRows[0]?.total || 0);
    return NextResponse.json({
      orders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('[GET /api/admin/orders] Failed:', error);
    return NextResponse.json({ error: 'Unable to load orders.' }, { status: 500 });
  }
}

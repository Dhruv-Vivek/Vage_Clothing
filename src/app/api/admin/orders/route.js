import { adminRoute, escapeLike } from '@/lib/admin';
import { listAdminOrders } from '@/lib/order-lifecycle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED']);
const VALID_PAYMENTS = new Set(['PENDING', 'PAID', 'FAILED', 'REFUNDED']);

export const GET = adminRoute(async ({ request }) => {
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1));
  const limit = Math.min(50, Math.max(10, Math.floor(Number(params.get('pageSize') || 20))));
  const status = String(params.get('status') || '').trim().toUpperCase();
  const payment = String(params.get('paymentStatus') || params.get('payment') || '').trim().toUpperCase();
  const search = String(params.get('q') || '').trim().slice(0, 100);

  const where = [];
  const values = [];
  if (status && VALID_STATUSES.has(status)) { where.push('o.status = ?'); values.push(status); }
  if (payment && VALID_PAYMENTS.has(payment)) { where.push('o.payment_status = ?'); values.push(payment); }
  if (search) {
    const like = `%${escapeLike(search)}%`;
    where.push('(o.order_number LIKE ? OR u.full_name LIKE ? OR COALESCE(NULLIF(o.contact_email, \'\'), u.email) LIKE ?)');
    values.push(like, like, like);
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const { query } = await import('@/lib/db');
  const orders = await query(
    `SELECT o.order_id, o.order_number, o.status, o.payment_status,
            o.total_amount, o.created_at, u.full_name AS customer_name,
            COALESCE(NULLIF(o.contact_email, ''), u.email) AS customer_email,
            (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.order_id) AS item_count,
            (SELECT p.payment_method FROM payments p WHERE p.order_id = o.order_id ORDER BY p.payment_id DESC LIMIT 1) AS payment_method
       FROM orders o INNER JOIN users u ON u.user_id = o.user_id
       ${whereSql}
      ORDER BY o.created_at DESC, o.order_id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    values
  );
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM orders o INNER JOIN users u ON u.user_id = o.user_id ${whereSql}`,
    values
  );
  const [{ count }] = await query('SELECT COUNT(*) AS count FROM orders');
  const counts = await query('SELECT status, COUNT(*) AS n FROM orders GROUP BY status');
  const statusCounts = {};
  for (const row of counts) statusCounts[row.status] = Number(row.n);
  return {
    orders: orders.map((row) => ({
      id: Number(row.order_id), orderId: Number(row.order_id), orderNumber: row.order_number,
      status: row.status, paymentStatus: row.payment_status, totalAmount: Number(row.total_amount),
      createdAt: row.created_at, customerName: row.customer_name, customerEmail: row.customer_email,
      itemCount: Number(row.item_count), paymentMethod: row.payment_method || null,
    })),
    counts: statusCounts,
    pagination: { page, pageSize: limit, total: Number(total), totalPages: Math.max(1, Math.ceil(Number(total) / limit)) },
  };
});

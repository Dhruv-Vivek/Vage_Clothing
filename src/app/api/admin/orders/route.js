import { query } from '@/lib/db';
import { adminRoute, escapeLike } from '@/lib/admin';
import { ORDER_STATUS_LABELS } from '@/lib/order-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = adminRoute(async ({ request }) => {
  const sp = new URL(request.url).searchParams;
  const search = (sp.get('q') || '').trim().slice(0, 100);
  const status = (sp.get('status') || 'all').toUpperCase();
  const payment = (sp.get('payment') || 'all').toUpperCase();
  const page = Math.max(1, Math.floor(Number(sp.get('page')) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(sp.get('limit')) || 20)));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  if (ORDER_STATUS_LABELS[status]) {
    where.push('o.status = ?');
    params.push(status);
  }
  if (['PENDING', 'PAID', 'FAILED', 'REFUNDED'].includes(payment)) {
    where.push('o.payment_status = ?');
    params.push(payment);
  }
  if (search) {
    const like = `%${escapeLike(search)}%`;
    where.push('(o.order_number LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)');
    params.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `SELECT o.order_id, o.order_number, o.status, o.payment_status, o.total_amount, o.created_at,
            u.full_name, u.email,
            (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items AS oi WHERE oi.order_id = o.order_id) AS item_count,
            (SELECT p.payment_method FROM payments AS p WHERE p.order_id = o.order_id ORDER BY p.payment_id DESC LIMIT 1) AS payment_method
       FROM orders AS o
       JOIN users AS u ON u.user_id = o.user_id
       ${whereSql}
      ORDER BY o.created_at DESC, o.order_id DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM orders AS o JOIN users AS u ON u.user_id = o.user_id ${whereSql}`,
    params
  );
  const countRows = await query('SELECT status, COUNT(*) AS n FROM orders GROUP BY status');
  const counts = {};
  for (const r of countRows) counts[r.status] = Number(r.n);

  return {
    orders: rows.map((r) => ({
      id: Number(r.order_id),
      orderNumber: r.order_number,
      status: r.status,
      paymentStatus: r.payment_status,
      paymentMethod: r.payment_method || null,
      totalAmount: Number(r.total_amount),
      itemCount: Number(r.item_count),
      createdAt: r.created_at,
      customerName: r.full_name,
      customerEmail: r.email,
    })),
    counts,
    pagination: { page, limit, total: Number(total), totalPages: Math.max(1, Math.ceil(Number(total) / limit)) },
  };
});

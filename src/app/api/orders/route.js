import { query } from '@/lib/db';
import { userRoute } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The signed-in customer's own orders, newest first. */
export const GET = userRoute(async ({ request, user }) => {
  const sp = new URL(request.url).searchParams;
  const page = Math.max(1, Math.floor(Number(sp.get('page')) || 1));
  const limit = Math.min(50, Math.max(1, Math.floor(Number(sp.get('limit')) || 10)));
  const offset = (page - 1) * limit;

  const orders = await query(
    `SELECT order_id, order_number, status, payment_status, total_amount, created_at
       FROM orders WHERE user_id = ?
      ORDER BY created_at DESC, order_id DESC
      LIMIT ${limit} OFFSET ${offset}`,
    [user.id]
  );
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?', [user.id]);

  let items = [];
  if (orders.length) {
    const ids = orders.map((o) => Number(o.order_id));
    items = await query(
      `SELECT oi.order_id, oi.product_name, oi.size, oi.color, oi.quantity, p.image_url
         FROM order_items AS oi
         LEFT JOIN product_variants AS pv ON pv.variant_id = oi.variant_id
         LEFT JOIN products AS p ON p.product_id = pv.product_id
        WHERE oi.order_id IN (${ids.map(() => '?').join(',')})
        ORDER BY oi.order_item_id`,
      ids
    );
  }

  return {
    orders: orders.map((o) => {
      const mine = items.filter((i) => Number(i.order_id) === Number(o.order_id));
      return {
        id: Number(o.order_id),
        orderNumber: o.order_number,
        status: o.status,
        paymentStatus: o.payment_status,
        totalAmount: Number(o.total_amount),
        createdAt: o.created_at,
        itemCount: mine.reduce((sum, i) => sum + Number(i.quantity), 0),
        items: mine.slice(0, 4).map((i) => ({
          name: i.product_name,
          size: i.size,
          color: i.color,
          quantity: Number(i.quantity),
          imageUrl: i.image_url || null,
        })),
      };
    }),
    pagination: { page, limit, total: Number(total), totalPages: Math.max(1, Math.ceil(Number(total) / limit)) },
  };
});

import { getPool } from '@/lib/db';
import { adminRoute, HttpError, cleanText, readJson, toId } from '@/lib/admin';
import { loadOrderDetail } from '@/lib/orders';
import { ADMIN_NEXT_STATUS } from '@/lib/order-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Record collected cash only after a COD order is delivered. */
export const POST = adminRoute(async ({ request, params }) => {
  const orderId = toId(params.id, 'Order');
  const body = await readJson(request);
  const reference = cleanText(body.reference, { label: 'Reference', max: 120 }) || 'Cash collected at delivery';

  const [rows] = await getPool().execute(
    `SELECT o.status, o.payment_status, p.payment_method
       FROM orders o
       INNER JOIN payments p ON p.payment_id = (
         SELECT MAX(p2.payment_id) FROM payments p2 WHERE p2.order_id = o.order_id
       )
      WHERE o.order_id = ?
      LIMIT 1`,
    [orderId]
  );
  const order = rows[0];
  if (!order) throw new HttpError(404, 'Order not found.');
  if (order.payment_method !== 'COD') {
    throw new HttpError(409, 'Only cash-on-delivery payments can be recorded manually here.');
  }
  if (order.status !== 'DELIVERED') {
    throw new HttpError(409, 'Record cash collection only after the COD order has been delivered.');
  }
  if (order.payment_status === 'PAID') {
    throw new HttpError(409, 'This order is already marked as paid.');
  }

  await getPool().execute('CALL confirm_payment(?, ?)', [orderId, reference]);

  const detail = await loadOrderDetail(orderId, { admin: true });
  if (!detail) throw new HttpError(404, 'Order not found.');
  detail.nextStatuses = ADMIN_NEXT_STATUS[detail.order.status] || [];
  return detail;
});

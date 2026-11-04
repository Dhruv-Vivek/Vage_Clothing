import { adminRoute, HttpError, cleanText, readJson, toId, withTransaction, run } from '@/lib/admin';
import { loadOrderDetail } from '@/lib/orders';
import { ADMIN_NEXT_STATUS } from '@/lib/order-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Record cash collection after delivery. This is a locked MySQL transaction,
 * not a dependency on a stored procedure that may not exist in older schemas.
 */
export const POST = adminRoute(async ({ request, params }) => {
  const orderId = toId(params.id, 'Order');
  const body = await readJson(request);
  const reference = cleanText(body.reference, { label: 'Reference', max: 120 }) ||
    `COD-COLLECTION-${orderId}-${Date.now()}`;

  await withTransaction(async (connection) => {
    const orders = await run(
      connection,
      'SELECT order_id, status, payment_status FROM orders WHERE order_id = ? FOR UPDATE',
      [orderId]
    );
    const order = orders[0];
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.status !== 'DELIVERED') {
      throw new HttpError(409, 'Record cash collection only after the COD order has been delivered.');
    }
    if (order.payment_status === 'PAID') {
      throw new HttpError(409, 'This order is already marked as paid.');
    }

    const payments = await run(
      connection,
      `SELECT payment_id, payment_method, status
         FROM payments
        WHERE order_id = ?
        ORDER BY payment_id DESC
        LIMIT 1
        FOR UPDATE`,
      [orderId]
    );
    const payment = payments[0];
    if (!payment) throw new HttpError(409, 'This order has no payment record.');
    if (payment.payment_method !== 'COD') {
      throw new HttpError(409, 'Only cash-on-delivery payments can be recorded manually here.');
    }
    if (payment.status === 'SUCCESS') {
      throw new HttpError(409, 'This payment is already marked as received.');
    }
    if (payment.status !== 'PENDING') {
      throw new HttpError(409, 'This COD payment is not in a state that can be marked as received.');
    }

    const paymentUpdate = await run(
      connection,
      `UPDATE payments
          SET status = 'SUCCESS', transaction_ref = ?, paid_at = NOW()
        WHERE payment_id = ? AND status = 'PENDING'`,
      [reference, payment.payment_id]
    );
    if (paymentUpdate.affectedRows !== 1) {
      throw new HttpError(409, 'The payment changed while it was being recorded. Refresh and try again.');
    }

    const orderUpdate = await run(
      connection,
      `UPDATE orders SET payment_status = 'PAID'
        WHERE order_id = ? AND payment_status <> 'PAID'`,
      [orderId]
    );
    if (orderUpdate.affectedRows !== 1) {
      throw new HttpError(409, 'The order payment status changed. Refresh and check the order.');
    }
  });

  const detail = await loadOrderDetail(orderId, { admin: true });
  if (!detail) throw new HttpError(404, 'Order not found.');
  detail.nextStatuses = ADMIN_NEXT_STATUS[detail.order.status] || [];
  return detail;
});

import { userRoute } from '@/lib/api';
import { cancelOrderInTx, loadOrderDetail, lockOrder } from '@/lib/orders';
import { CUSTOMER_CANCELLABLE } from '@/lib/order-status';
import { HttpError, toId, withTransaction } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = userRoute(async ({ params, user }) => {
  const orderId = toId(params.id, 'Order');

  await withTransaction(async (connection) => {
    const order = await lockOrder(connection, orderId, user.id);
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
      throw new HttpError(409, 'This order has already moved on and can no longer be cancelled here. Please contact us.');
    }
    if (order.payment_status === 'PAID') {
      throw new HttpError(409, 'This order is already paid. Please contact us to cancel and arrange a refund.');
    }
    await cancelOrderInTx(connection, order, { actorId: user.id, note: 'Cancelled by customer' });
  });

  const detail = await loadOrderDetail(orderId, { userId: user.id });
  detail.canCancel = false;
  return detail;
});

import { userRoute } from '@/lib/api';
import { loadOrderDetail } from '@/lib/orders';
import { HttpError, toId } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** One order, only if it belongs to the signed-in customer (someone else's order looks like "not found"). */
export const GET = userRoute(async ({ params, user }) => {
  const detail = await loadOrderDetail(toId(params.id, 'Order'), { userId: user.id });
  if (!detail) throw new HttpError(404, 'Order not found.');
  const payment = detail.payments[detail.payments.length - 1];
  const isCodAwaitingCollection =
    detail.order.status === 'PENDING' &&
    payment?.method === 'COD' &&
    detail.order.paymentStatus !== 'PAID';
  const isRefundablePaidOrder =
    ['CONFIRMED', 'PROCESSING'].includes(detail.order.status) &&
    (detail.order.paymentStatus !== 'PAID' || ['RAZORPAY', 'DEMO'].includes(payment?.gateway));
  detail.canCancel = isCodAwaitingCollection || isRefundablePaidOrder;
  return detail;
});

import { userRoute } from '@/lib/api';
import { cancelOrder } from '@/lib/order-lifecycle';
import { loadOrderDetail } from '@/lib/orders';
import { HttpError, toId } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Use the central order lifecycle service so paid Razorpay orders are refunded
 * idempotently, demo refunds are labelled as simulated, and unsupported
 * providers are never falsely marked as refunded.
 */
export const POST = userRoute(async ({ params, user }) => {
  const orderId = toId(params.id, 'Order');
  const cancellation = await cancelOrder({ orderId, userId: user.id, actor: user });
  const detail = await loadOrderDetail(orderId, { userId: user.id });
  if (!detail) throw new HttpError(404, 'Order not found.');
  detail.canCancel = false;
  detail.cancellation = {
    status: cancellation.status,
    refunded: Boolean(cancellation.refunded),
    refundId: cancellation.refundId || null,
    simulatedRefund: Boolean(cancellation.simulatedRefund),
    alreadyFinal: Boolean(cancellation.alreadyFinal),
  };
  return detail;
});

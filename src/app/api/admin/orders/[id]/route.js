import { adminRoute, HttpError, cleanText, readJson, toId } from '@/lib/admin';
import { adminAdvanceOrder } from '@/lib/order-lifecycle';
import { loadOrderDetail } from '@/lib/orders';
import { ADMIN_NEXT_STATUS, ORDER_STATUS_LABELS } from '@/lib/order-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function detailFor(orderId) {
  const detail = await loadOrderDetail(orderId, { admin: true });
  if (!detail) throw new HttpError(404, 'Order not found.');
  detail.nextStatuses = ADMIN_NEXT_STATUS[detail.order.status] || [];
  return detail;
}

export const GET = adminRoute(async ({ params }) => detailFor(toId(params.id, 'Order')));

/**
 * Keep every state change inside order-lifecycle. That service enforces valid transitions,
 * restores stock/coupons on cancellation, sends lifecycle email events and refunds captured
 * Razorpay payments safely. The response remains the full detail shape expected by the UI.
 */
export const PATCH = adminRoute(async ({ request, params, user }) => {
  const orderId = toId(params.id, 'Order');
  const body = await readJson(request);
  const nextStatus = String(body.nextStatus || body.status || '').trim().toUpperCase();
  const note = cleanText(body.note, { label: 'Note', max: 500, required: false });

  if (!ORDER_STATUS_LABELS[nextStatus]) {
    throw new HttpError(400, 'Choose a valid order status.');
  }

  await adminAdvanceOrder({ orderId, nextStatus, note, actor: user });
  return detailFor(orderId);
});

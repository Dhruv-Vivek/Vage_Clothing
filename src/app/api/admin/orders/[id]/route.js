import { adminRoute, HttpError, cleanText, readJson, toId, withTransaction, run } from '@/lib/admin';
import { cancelOrderInTx, loadOrderDetail, lockOrder, stampLatestHistory } from '@/lib/orders';
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
 * Move an order to its next status. The database trigger trg_order_status_guard is the real rule-keeper
 * (an illegal jump is rejected with its own message). Cancelling also puts the stock back.
 */
export const PATCH = adminRoute(async ({ request, params, user }) => {
  const orderId = toId(params.id, 'Order');
  const body = await readJson(request);
  const target = String(body.status || '').toUpperCase();
  const note = cleanText(body.note, { label: 'Note', max: 400 });

  if (!ORDER_STATUS_LABELS[target]) throw new HttpError(400, 'Choose a valid status.');
  if (target === 'RETURNED') {
    throw new HttpError(400, 'Returns are not handled here yet.');
  }

  await withTransaction(async (connection) => {
    const order = await lockOrder(connection, orderId);
    if (target === 'CANCELLED') {
      await cancelOrderInTx(connection, order, { actorId: user.id, note: note || 'Cancelled by admin' });
    } else {
      await run(connection, 'UPDATE orders SET status = ? WHERE order_id = ?', [target, orderId]);
      await stampLatestHistory(connection, orderId, user.id, note || `Marked ${ORDER_STATUS_LABELS[target].toLowerCase()} by admin`);
    }
  });

  return detailFor(orderId);
});

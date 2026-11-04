import { getPool } from '@/lib/db';
import { adminRoute, HttpError, cleanText, readJson, toId } from '@/lib/admin';
import { loadOrderDetail } from '@/lib/orders';
import { ADMIN_NEXT_STATUS } from '@/lib/order-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Record that the money was received (e.g. cash collected on delivery) using the confirm_payment stored procedure. */
export const POST = adminRoute(async ({ request, params }) => {
  const orderId = toId(params.id, 'Order');
  const body = await readJson(request);
  const reference = cleanText(body.reference, { label: 'Reference', max: 120 }) || 'Received by admin';

  await getPool().execute('CALL confirm_payment(?, ?)', [orderId, reference]);

  const detail = await loadOrderDetail(orderId, { admin: true });
  if (!detail) throw new HttpError(404, 'Order not found.');
  detail.nextStatuses = ADMIN_NEXT_STATUS[detail.order.status] || [];
  return detail;
});

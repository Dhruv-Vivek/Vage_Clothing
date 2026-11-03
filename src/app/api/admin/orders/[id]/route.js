import { adminRoute, readJson, toId, cleanText } from '@/lib/admin';
import { adminAdvanceOrder } from '@/lib/order-lifecycle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = adminRoute(async ({ request, params, user }) => {
  const orderId = toId(params.id, 'Order ID');
  const body = await readJson(request);
  const nextStatus = String(body.nextStatus || '').trim().toUpperCase();
  const note = cleanText(body.note, { label: 'Note', max: 500, required: false });
  const result = await adminAdvanceOrder({ orderId, nextStatus, note, actor: user });
  return result;
});

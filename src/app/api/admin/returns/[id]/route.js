import { adminRoute, readJson, toId, cleanText } from '@/lib/admin';
import { adminUpdateReturn } from '@/lib/order-lifecycle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = adminRoute(async ({ request, params, user }) => {
  const returnId = toId(params.id, 'Return ID');
  const body = await readJson(request);
  const nextStatus = String(body.nextStatus || '').trim().toUpperCase();
  const notes = cleanText(body.notes, { label: 'Resolution note', max: 500, required: false, multiline: true });
  return adminUpdateReturn({ returnId, nextStatus, notes, actor: user });
});

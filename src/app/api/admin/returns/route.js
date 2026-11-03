import { adminRoute } from '@/lib/admin';
import { listAdminReturns } from '@/lib/order-lifecycle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = adminRoute(async ({ request }) => {
  const url = new URL(request.url);
  const returns = await listAdminReturns({
    status: url.searchParams.get('status') || '',
    limit: Number(url.searchParams.get('limit') || 100),
  });
  return { returns };
});

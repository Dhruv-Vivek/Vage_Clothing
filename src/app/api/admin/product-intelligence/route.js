import { adminRoute, HttpError } from '@/lib/admin';
import { isProductIntelligenceEnabled } from '@/lib/mongodb';
import { getProductIntelligenceReport } from '@/lib/product-intelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = adminRoute(async ({ request }) => {
  if (!isProductIntelligenceEnabled()) {
    throw new HttpError(503, 'MongoDB product intelligence is not configured. Add MONGODB_URI and enable PRODUCT_INTELLIGENCE_ENABLED in .env.local.');
  }

  const url = new URL(request.url);
  const requestedDays = Number(url.searchParams.get('days') || 30);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;

  try {
    return await getProductIntelligenceReport(days);
  } catch (error) {
    console.error('[GET /api/admin/product-intelligence]', error);
    throw new HttpError(503, 'Unable to connect to MongoDB product intelligence. Check MONGODB_URI and Atlas network access.');
  }
});

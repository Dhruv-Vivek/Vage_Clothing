import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isProductIntelligenceEnabled } from '@/lib/mongodb';
import { recordProductEvent } from '@/lib/product-intelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!isProductIntelligenceEnabled()) {
    return NextResponse.json(
      { error: 'Product intelligence is not configured. Add MONGODB_URI to the server environment.' },
      { status: 503 }
    );
  }

  try {
    const raw = await request.text();
    if (raw.length > 8192) {
      return NextResponse.json({ error: 'Analytics event is too large.' }, { status: 413 });
    }

    let body;
    try { body = JSON.parse(raw); }
    catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

    const user = await getCurrentUser();
    const result = await recordProductEvent(body, user);
    return NextResponse.json(result, { status: result.duplicate ? 200 : 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    if (status >= 500) console.error('[POST /api/analytics/events]', error);
    return NextResponse.json(
      { error: status >= 500 ? 'Unable to record product activity.' : error.message },
      { status }
    );
  }
}

import 'server-only';

/**
 * Next.js server API wrappers for authenticated backend service calls; no direct SQL is declared here.
 * See backend/README.md for the database/backend walkthrough.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { HttpError, toErrorResponse } from '@/lib/admin';

/**
 * Wraps a customer-facing /api route: the caller must be a signed-in, active user
 * (the user id always comes from the signed session cookie, never from the request body).
 * Handler receives { request, params, user }.
 */
export function userRoute(handler) {
  return async function route(request, context) {
    try {
      const user = await getCurrentUser();
      if (!user) throw new HttpError(401, 'Please log in to continue.');

      const params = context?.params ? await context.params : {};
      const result = await handler({ request, params, user });
      if (result instanceof Response) return result;
      return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return toErrorResponse(error, request);
    }
  };
}

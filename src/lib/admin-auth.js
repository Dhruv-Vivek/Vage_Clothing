import 'server-only';

import { getCurrentUser } from '@/lib/auth';

/**
 * Resolve admin permission from the active MySQL user record on every request.
 * Never trust a role copied from the browser or local storage.
 */
export async function getAdminAccess() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      status: 401,
      error: 'Please sign in with an administrator account.',
    };
  }

  if (user.role !== 'ADMIN') {
    return {
      ok: false,
      status: 403,
      error: 'You do not have permission to access VAGE administration.',
    };
  }

  return { ok: true, user };
}

import { query, getPool } from '@/lib/db';
import { userRoute } from '@/lib/api';
import { HttpError, readJson, toId } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Make this address the default (uses the set_default_address stored procedure). */
export const PATCH = userRoute(async ({ request, params, user }) => {
  const addressId = toId(params.id, 'Address');
  const body = await readJson(request);
  if (body.isDefault !== true) throw new HttpError(400, 'Only isDefault: true is supported.');
  await getPool().execute('CALL set_default_address(?, ?)', [user.id, addressId]);
  return { updated: true };
});

/**
 * Addresses used by an order are kept: deleting one would blank the delivery address on that order
 * (the foreign key sets it to NULL), so those can't be removed.
 */
export const DELETE = userRoute(async ({ params, user }) => {
  const addressId = toId(params.id, 'Address');

  const [own] = await query('SELECT 1 AS ok FROM addresses WHERE address_id = ? AND user_id = ?', [addressId, user.id]);
  if (!own) throw new HttpError(404, 'Address not found.');

  const [used] = await query('SELECT 1 AS ok FROM orders WHERE address_id = ? LIMIT 1', [addressId]);
  if (used) throw new HttpError(409, "This address was used for an order, so it can't be deleted.");

  await query('DELETE FROM addresses WHERE address_id = ? AND user_id = ?', [addressId, user.id]);
  return { deleted: true };
});

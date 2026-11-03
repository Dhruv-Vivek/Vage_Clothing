import { HttpError, adminRoute, cleanInt, cleanText, readJson, run, toId, withTransaction } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_STOCK = 1_000_000;

/**
 * Set stock to an absolute number ({ stock }) or adjust it ({ delta }).
 * The row is locked while we work, and the database trigger writes the audit entry;
 * we then stamp that entry with the admin and the reason so the log shows who changed what.
 */
export const PATCH = adminRoute(async ({ request, params, user }) => {
  const variantId = toId(params.variantId, 'Variant ID');
  const body = await readJson(request);
  const reason =
    cleanText(body.reason, { label: 'Reason', max: 200 }) || 'Manual adjustment by admin';

  if ((body.stock === undefined) === (body.delta === undefined)) {
    throw new HttpError(400, 'Send either stock or delta.');
  }

  return withTransaction(async (connection) => {
    const variant = await run(connection, 'SELECT 1 FROM product_variants WHERE variant_id = ? LIMIT 1', [variantId]);
    if (!variant.length) throw new HttpError(404, 'Variant not found.');

    const current = await run(
      connection,
      'SELECT stock_quantity FROM inventory WHERE variant_id = ? FOR UPDATE',
      [variantId]
    );
    const before = current.length ? Number(current[0].stock_quantity) : 0;

    const after =
      body.stock !== undefined
        ? cleanInt(body.stock, 'Stock', { max: MAX_STOCK })
        : before + cleanInt(body.delta, 'Change', { min: -MAX_STOCK, max: MAX_STOCK });
    if (after < 0) throw new HttpError(400, 'Stock cannot go below 0.');
    if (after > MAX_STOCK) throw new HttpError(400, `Stock cannot exceed ${MAX_STOCK.toLocaleString('en-IN')}.`);

    if (!current.length) {
      await run(connection, 'INSERT INTO inventory (variant_id, stock_quantity) VALUES (?, ?)', [variantId, after]);
      if (after > 0) {
        await run(
          connection,
          `INSERT INTO inventory_log
             (variant_id, change_type, quantity_change, stock_before, stock_after, reason, changed_by)
           VALUES (?, 'STOCK_IN', ?, 0, ?, ?, ?)`,
          [variantId, after, after, reason, user.id]
        );
      }
    } else if (after !== before) {
      await run(connection, 'UPDATE inventory SET stock_quantity = ? WHERE variant_id = ?', [after, variantId]);
      // The trigger just inserted the newest log row for this variant (we hold the row lock).
      await run(
        connection,
        'UPDATE inventory_log SET changed_by = ?, reason = ? WHERE variant_id = ? ORDER BY log_id DESC LIMIT 1',
        [user.id, reason, variantId]
      );
    }
    return { variantId, before, after };
  });
});

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { validateAddressPayload } from '@/lib/account-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function parseId(context) {
  const raw = (await context.params).id;
  const id = Number(raw);
  return /^\d+$/.test(String(raw)) && Number.isSafeInteger(id) && id > 0 ? id : null;
}

function mapAddress(row) {
  return {
    id: Number(row.saved_address_id),
    label: row.label,
    recipientName: row.recipient_name,
    phone: row.phone,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2 || '',
    city: row.city,
    stateName: row.state_name,
    postalCode: row.postal_code,
    country: row.country,
    isDefault: Boolean(row.is_default),
    updatedAt: row.updated_at,
  };
}

export async function PATCH(request, context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const addressId = await parseId(context);
  if (!addressId) return NextResponse.json({ error: 'Invalid address ID.' }, { status: 400 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const validated = validateAddressPayload(body);
  if (validated.error) return NextResponse.json({ error: validated.error }, { status: 400 });
  const address = validated.value;
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute(
      'SELECT saved_address_id, is_default FROM saved_addresses WHERE saved_address_id = ? AND user_id = ? FOR UPDATE',
      [addressId, user.id]
    );
    if (!existing.length) {
      await connection.rollback();
      return NextResponse.json({ error: 'Saved address not found.' }, { status: 404 });
    }
    const makeDefault = address.isDefault || Boolean(existing[0].is_default);
    if (makeDefault) {
      await connection.execute('UPDATE saved_addresses SET is_default = 0 WHERE user_id = ?', [user.id]);
    }
    await connection.execute(
      'UPDATE saved_addresses SET label = ?, recipient_name = ?, phone = ?, address_line1 = ?, address_line2 = ?, city = ?, state_name = ?, postal_code = ?, country = ?, is_default = ? ' +
      'WHERE saved_address_id = ? AND user_id = ?',
      [address.label, address.recipientName, address.phone, address.addressLine1, address.addressLine2, address.city,
        address.stateName, address.postalCode, address.country, makeDefault ? 1 : 0, addressId, user.id]
    );
    if (!makeDefault) {
      const [defaults] = await connection.execute(
        'SELECT saved_address_id FROM saved_addresses WHERE user_id = ? AND is_default = 1 LIMIT 1',
        [user.id]
      );
      if (!defaults.length) {
        await connection.execute(
          'UPDATE saved_addresses SET is_default = 1 WHERE saved_address_id = ? AND user_id = ?',
          [addressId, user.id]
        );
      }
    }
    await connection.commit();
    const [rows] = await pool.execute(
      'SELECT saved_address_id, label, recipient_name, phone, address_line1, address_line2, city, state_name, postal_code, country, is_default, updated_at ' +
      'FROM saved_addresses WHERE saved_address_id = ? AND user_id = ? LIMIT 1',
      [addressId, user.id]
    );
    return NextResponse.json({ address: mapAddress(rows[0]) });
  } catch (error) {
    await connection.rollback();
    console.error('[PATCH /api/account/addresses/:id] Failed:', error);
    return NextResponse.json({ error: 'Unable to update this address.' }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function DELETE(_request, context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const addressId = await parseId(context);
  if (!addressId) return NextResponse.json({ error: 'Invalid address ID.' }, { status: 400 });

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute(
      'SELECT is_default FROM saved_addresses WHERE saved_address_id = ? AND user_id = ? FOR UPDATE',
      [addressId, user.id]
    );
    if (!existing.length) {
      await connection.rollback();
      return NextResponse.json({ error: 'Saved address not found.' }, { status: 404 });
    }
    await connection.execute(
      'DELETE FROM saved_addresses WHERE saved_address_id = ? AND user_id = ?',
      [addressId, user.id]
    );
    if (existing[0].is_default) {
      await connection.execute(
        'UPDATE saved_addresses SET is_default = 1 WHERE user_id = ? ORDER BY updated_at DESC, saved_address_id DESC LIMIT 1',
        [user.id]
      );
    }
    await connection.commit();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    await connection.rollback();
    console.error('[DELETE /api/account/addresses/:id] Failed:', error);
    return NextResponse.json({ error: 'Unable to delete this address.' }, { status: 500 });
  } finally {
    connection.release();
  }
}

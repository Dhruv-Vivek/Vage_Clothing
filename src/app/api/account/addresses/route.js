// EMBEDDED MYSQL: the address book uses SELECT/INSERT and transaction-bound UPDATE statements; ownership checks use the authenticated user id.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { validateAddressPayload } from '@/lib/account-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  try {
    const [rows] = await getPool().execute(
      'SELECT saved_address_id, label, recipient_name, phone, address_line1, address_line2, city, state_name, postal_code, country, is_default, updated_at ' +
      'FROM saved_addresses WHERE user_id = ? ORDER BY is_default DESC, updated_at DESC, saved_address_id DESC',
      [user.id]
    );
    return NextResponse.json({ addresses: rows.map(mapAddress) }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('[GET /api/account/addresses] Failed:', error);
    return NextResponse.json({ error: 'Unable to load saved addresses.' }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

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
    const [userRows] = await connection.execute(
      'SELECT user_id FROM users WHERE user_id = ? FOR UPDATE',
      [user.id]
    );
    if (!userRows.length) {
      await connection.rollback();
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }
    const [countRows] = await connection.execute(
      'SELECT COUNT(*) AS total FROM saved_addresses WHERE user_id = ?',
      [user.id]
    );
    if (Number(countRows[0]?.total || 0) >= 20) {
      await connection.rollback();
      return NextResponse.json({ error: 'You can save up to 20 addresses.' }, { status: 409 });
    }
    const makeDefault = address.isDefault || Number(countRows[0]?.total || 0) === 0;
    if (makeDefault) {
      await connection.execute('UPDATE saved_addresses SET is_default = 0 WHERE user_id = ?', [user.id]);
    }
    const [insert] = await connection.execute(
      'INSERT INTO saved_addresses (user_id, label, recipient_name, phone, address_line1, address_line2, city, state_name, postal_code, country, is_default) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [user.id, address.label, address.recipientName, address.phone, address.addressLine1, address.addressLine2,
        address.city, address.stateName, address.postalCode, address.country, makeDefault ? 1 : 0]
    );
    await connection.commit();
    const [rows] = await pool.execute(
      'SELECT saved_address_id, label, recipient_name, phone, address_line1, address_line2, city, state_name, postal_code, country, is_default, updated_at ' +
      'FROM saved_addresses WHERE saved_address_id = ? AND user_id = ? LIMIT 1',
      [insert.insertId, user.id]
    );
    return NextResponse.json({ address: mapAddress(rows[0]) }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error('[POST /api/account/addresses] Failed:', error);
    return NextResponse.json({ error: 'Unable to save this address.' }, { status: 500 });
  } finally {
    connection.release();
  }
}

import { query, getPool } from '@/lib/db';
import { userRoute } from '@/lib/api';
import { HttpError, cleanAddress, readJson } from '@/lib/validate';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ADDRESSES = 10;

function mapAddress(row) {
  return {
    id: Number(row.address_id),
    recipientName: row.recipient_name,
    phone: row.phone,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2 || '',
    city: row.city,
    state: row.state_name,
    postalCode: row.postal_code,
    country: row.country,
    isDefault: Boolean(row.is_default),
  };
}

async function listAddresses(userId) {
  const rows = await query(
    'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, address_id DESC',
    [userId]
  );
  return rows.map(mapAddress);
}

export const GET = userRoute(async ({ user }) => ({ addresses: await listAddresses(user.id) }));

export const POST = userRoute(async ({ request, user }) => {
  const body = await readJson(request);
  const a = cleanAddress(body);

  const [{ n }] = await query('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?', [user.id]);
  if (Number(n) >= MAX_ADDRESSES) {
    throw new HttpError(400, `You can save up to ${MAX_ADDRESSES} addresses. Remove one first.`);
  }

  const result = await query(
    `INSERT INTO addresses
       (user_id, recipient_name, phone, address_line1, address_line2, city, state_name, postal_code, country, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [user.id, a.recipientName, a.phone, a.line1, a.line2, a.city, a.state, a.postalCode, a.country]
  );
  const addressId = Number(result.insertId);

  // The first address, or one explicitly marked default, becomes the default via the database procedure.
  if (Number(n) === 0 || body.isDefault === true) {
    await getPool().execute('CALL set_default_address(?, ?)', [user.id, addressId]);
  }
  return NextResponse.json({ addresses: await listAddresses(user.id), addressId }, { status: 201 });
});

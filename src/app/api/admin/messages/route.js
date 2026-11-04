import { getPool } from '@/lib/db';
import { adminRoute } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = adminRoute(async ({ request }) => {
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  const pageSize = Math.max(10, Math.min(50, Number.parseInt(params.get('pageSize') || '20', 10) || 20));
  const search = String(params.get('q') || '').trim().slice(0, 100);
  const where = [];
  const values = [];

  if (search) {
    where.push('(full_name LIKE ? OR email LIKE ? OR subject LIKE ?)');
    const pattern = '%' + search + '%';
    values.push(pattern, pattern, pattern);
  }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (page - 1) * pageSize;
  const pool = getPool();

  try {
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) AS total FROM contact_messages ' + whereSql,
      values
    );
    const [messages] = await pool.execute(
      'SELECT contact_message_id, full_name, email, phone, subject, message, ' +
      'notification_status, notification_attempts, notification_last_error, notification_sent_at, ' +
      'acknowledgement_status, acknowledgement_attempts, acknowledgement_last_error, acknowledgement_sent_at, created_at ' +
      'FROM contact_messages ' + whereSql +
      ' ORDER BY created_at DESC, contact_message_id DESC LIMIT ? OFFSET ?',
      [...values, pageSize, offset]
    );

    const total = Number(countRows[0]?.total || 0);
    return {
      messages,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  } catch (error) {
    console.error('[GET /api/admin/messages] Failed:', error);
    throw new Error('Unable to load contact messages.');
  }
});

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { dispatchContactMessageEmails } from '@/lib/contact-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function clean(value, maxLength) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, maxLength);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Please submit a valid contact form.', 400);
  }

  // Honeypot for basic bot filtering. Never store its value.
  if (clean(body?.website, 200)) {
    return NextResponse.json({ success: true, message: 'Your message has been received.' });
  }

  const fullName = clean(body?.fullName, 120);
  const email = clean(body?.email, 190).toLowerCase();
  const phone = clean(body?.phone, 30);
  const subject = clean(body?.subject, 160);
  const message = clean(body?.message, 5000);

  if (fullName.length < 2) return jsonError('Please enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('Enter a valid email address.');
  if (phone && !/^[+()\d\s.-]{7,30}$/.test(phone)) return jsonError('Enter a valid phone number or leave it blank.');
  if (subject.length < 3) return jsonError('Please enter a subject.');
  if (message.length < 10) return jsonError('Please write a message of at least 10 characters.');

  const pool = getPool();
  try {
    const [recent] = await pool.execute(
      `SELECT COUNT(*) AS message_count
       FROM contact_messages
       WHERE email = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [email]
    );

    if (Number(recent[0]?.message_count || 0) >= 5) {
      return jsonError('Too many messages from this email address. Please try again later.', 429);
    }

    const [insert] = await pool.execute(
      `INSERT INTO contact_messages
         (full_name, email, phone, subject, message,
          notification_status, acknowledgement_status)
       VALUES (?, ?, ?, ?, ?, 'PENDING', 'PENDING')`,
      [fullName, email, phone || null, subject, message]
    );

    const contactMessageId = Number(insert.insertId);
    const emailResults = await dispatchContactMessageEmails(contactMessageId).catch((error) => {
      console.error('[POST /api/contact] Contact emails queued for retry:', error);
      return [];
    });

    return NextResponse.json({
      success: true,
      message: 'Your message has been saved. The VAGE team has been notified, and a confirmation email will be sent when mail delivery is available.',
      contactMessageId,
      emailResults,
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/contact] Failed:', error);
    return jsonError('We could not save your message right now. Please try again later.', 500);
  }
}

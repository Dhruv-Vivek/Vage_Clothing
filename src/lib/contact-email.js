import 'server-only';

import { getPool } from '@/lib/db';
import { getVageMailboxConfig, sendVageEmail } from '@/lib/gmail-mailer';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function claimMessage(connection, messageId, kind) {
  const statusColumn = kind === 'notification' ? 'notification_status' : 'acknowledgement_status';
  const attemptsColumn = kind === 'notification' ? 'notification_attempts' : 'acknowledgement_attempts';

  const [result] = await connection.execute(
    `UPDATE contact_messages
     SET ${statusColumn} = 'PROCESSING',
         ${attemptsColumn} = ${attemptsColumn} + 1
     WHERE contact_message_id = ?
       AND ${attemptsColumn} < 5
       AND (
         ${statusColumn} IN ('PENDING','FAILED')
         OR (${statusColumn} = 'PROCESSING' AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE))
       )`,
    [messageId]
  );

  return result.affectedRows === 1;
}

async function updateMessageStatus(pool, messageId, kind, status, error = null, providerMessageId = null) {
  if (kind === 'notification') {
    await pool.execute(
      `UPDATE contact_messages
       SET notification_status = ?,
           notification_last_error = ?,
           notification_message_id = COALESCE(?, notification_message_id),
           notification_sent_at = IF(? = 'SENT', NOW(), notification_sent_at)
       WHERE contact_message_id = ?`,
      [status, error, providerMessageId, status, messageId]
    );
  } else {
    await pool.execute(
      `UPDATE contact_messages
       SET acknowledgement_status = ?,
           acknowledgement_last_error = ?,
           acknowledgement_message_id = COALESCE(?, acknowledgement_message_id),
           acknowledgement_sent_at = IF(? = 'SENT', NOW(), acknowledgement_sent_at)
       WHERE contact_message_id = ?`,
      [status, error, providerMessageId, status, messageId]
    );
  }
}

export async function dispatchContactMessageEmails(messageId) {
  const numericId = Number(messageId);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    throw new Error('A valid contact message ID is required.');
  }

  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT contact_message_id, full_name, email, phone, subject, message
     FROM contact_messages
     WHERE contact_message_id = ?
     LIMIT 1`,
    [numericId]
  );
  if (!rows.length) throw new Error('Contact message was not found.');

  const item = rows[0];
  const { contactTo, user: sender } = getVageMailboxConfig();
  const safeName = escapeHtml(item.full_name);
  const safeEmail = escapeHtml(item.email);
  const safePhone = escapeHtml(item.phone || 'Not provided');
  const safeSubject = escapeHtml(item.subject);
  const safeMessage = escapeHtml(item.message).replace(/\r?\n/g, '<br/>');

  const connection = await pool.getConnection();
  let notificationClaimed = false;
  let acknowledgementClaimed = false;
  try {
    await connection.beginTransaction();
    notificationClaimed = await claimMessage(connection, numericId, 'notification');
    acknowledgementClaimed = await claimMessage(connection, numericId, 'acknowledgement');
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const results = [];

  if (notificationClaimed) {
    try {
      const sent = await sendVageEmail({
        to: contactTo,
        replyTo: item.email,
        subject: `[VAGE Contact #${numericId}] ${item.subject}`,
        html: `<div style="font-family:Arial,sans-serif;background:#111;color:#eee;padding:28px;border-radius:12px;max-width:640px">
          <p style="letter-spacing:5px;color:#aaa">V A G E</p>
          <h2>New Contact Us message</h2>
          <p><strong>Message ID:</strong> #${numericId}</p>
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Phone:</strong> ${safePhone}</p>
          <p><strong>Subject:</strong> ${safeSubject}</p>
          <div style="margin-top:20px;padding:18px;background:#1b1b1b;border:1px solid #333;border-radius:8px;line-height:1.6">${safeMessage}</div>
          <p style="color:#999;font-size:12px;margin-top:20px">Reply to this email to respond directly to the customer.</p>
        </div>`,
        text: `New VAGE Contact Us message #${numericId}\nName: ${item.full_name}\nEmail: ${item.email}\nPhone: ${item.phone || 'Not provided'}\nSubject: ${item.subject}\n\n${item.message}`,
        messageId: `<vage-contact-${numericId}-notification@${sender.split('@')[1]}>`,
      });

      await updateMessageStatus(pool, numericId, 'notification', 'SENT', null, sent.messageId);
      results.push({ kind: 'notification', status: 'SENT' });
    } catch (error) {
      const message = String(error?.message || 'Contact notification email failed.').slice(0, 950);
      await updateMessageStatus(pool, numericId, 'notification', 'FAILED', message);
      results.push({ kind: 'notification', status: 'FAILED', error: message });
    }
  }

  if (acknowledgementClaimed) {
    try {
      const sent = await sendVageEmail({
        to: item.email,
        replyTo: contactTo,
        subject: 'We received your message — VAGE Clothing',
        html: `<div style="font-family:Arial,sans-serif;background:#111;color:#eee;padding:28px;border-radius:12px;max-width:640px">
          <p style="letter-spacing:5px;color:#aaa">V A G E</p>
          <h2>Thanks for reaching out, ${safeName}.</h2>
          <p style="color:#ccc;line-height:1.6">Your message has reached the VAGE team. We will review it and get back to you at this email address.</p>
          <div style="padding:16px;background:#1b1b1b;border:1px solid #333;border-radius:8px">
            <p style="color:#aaa;font-size:12px;margin-top:0">YOUR MESSAGE</p>
            <p><strong>${safeSubject}</strong></p>
            <p style="line-height:1.6">${safeMessage}</p>
          </div>
          <p style="color:#999;font-size:12px;margin-top:22px">VAGE Clothing · Customer Support</p>
        </div>`,
        text: `Hi ${item.full_name},\n\nWe received your message and the VAGE team will review it.\n\nSubject: ${item.subject}\n\n${item.message}\n\nVAGE Clothing Support`,
        messageId: `<vage-contact-${numericId}-ack@${sender.split('@')[1]}>`,
      });

      await updateMessageStatus(pool, numericId, 'acknowledgement', 'SENT', null, sent.messageId);
      results.push({ kind: 'acknowledgement', status: 'SENT' });
    } catch (error) {
      const message = String(error?.message || 'Contact acknowledgement email failed.').slice(0, 950);
      await updateMessageStatus(pool, numericId, 'acknowledgement', 'FAILED', message);
      results.push({ kind: 'acknowledgement', status: 'FAILED', error: message });
    }
  }

  return results;
}

export async function dispatchPendingContactEmails(limit = 20) {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const [rows] = await pool.execute(
    `SELECT contact_message_id
     FROM contact_messages
     WHERE (
       notification_status IN ('PENDING','FAILED')
       AND notification_attempts < 5
       AND updated_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
     ) OR (
       acknowledgement_status IN ('PENDING','FAILED')
       AND acknowledgement_attempts < 5
       AND updated_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
     ) OR (
       notification_status = 'PROCESSING'
       AND notification_attempts < 5
       AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
     ) OR (
       acknowledgement_status = 'PROCESSING'
       AND acknowledgement_attempts < 5
       AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
     )
     ORDER BY contact_message_id
     LIMIT ?`,
    [safeLimit]
  );

  const results = [];
  for (const row of rows) {
    try {
      results.push({
        contactMessageId: Number(row.contact_message_id),
        results: await dispatchContactMessageEmails(row.contact_message_id),
      });
    } catch (error) {
      results.push({
        contactMessageId: Number(row.contact_message_id),
        error: String(error?.message || 'Contact email retry failed.'),
      });
    }
  }

  return { checked: rows.length, results };
}

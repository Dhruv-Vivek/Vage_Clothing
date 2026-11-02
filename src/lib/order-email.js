import 'server-only';

import { Resend } from 'resend';
import { getPool } from '@/lib/db';

let resendClient;

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured.');
  }
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

/** Call inside the same DB transaction that marks the order as paid. */
export async function enqueuePaidOrderEmails(connection, order) {
  const orderId = Number(order.order_id);
  const orderNumber = String(order.order_number);
  const recipient = String(order.email);

  await connection.execute(
    `INSERT IGNORE INTO email_outbox
       (dedupe_key, event_type, recipient_email, subject, payload, status)
     VALUES (?, 'ORDER_CONFIRMATION', ?, ?, JSON_OBJECT('orderId', ?), 'PENDING')`,
    [`order-confirmation/${orderId}`, recipient, `VAGE order ${orderNumber} confirmed`, orderId]
  );

  await connection.execute(
    `INSERT IGNORE INTO email_outbox
       (dedupe_key, event_type, recipient_email, subject, payload, status)
     VALUES (?, 'PAYMENT_RECEIPT', ?, ?, JSON_OBJECT('orderId', ?), 'PENDING')`,
    [`payment-receipt/${orderId}`, recipient, `VAGE payment receipt — ${orderNumber}`, orderId]
  );
}

async function loadOrderEmailData(orderId) {
  const pool = getPool();
  const [orderRows] = await pool.execute(
    `SELECT
        o.order_id, o.order_number, o.status, o.payment_status,
        o.subtotal, o.discount_amount, o.coupon_discount_amount,
        o.membership_discount_amount, o.shipping_amount, o.total_amount,
        o.created_at, u.full_name, u.email,
        a.recipient_name, a.phone, a.address_line1, a.address_line2,
        a.city, a.state_name, a.postal_code, a.country,
        p.transaction_ref, p.paid_at
     FROM orders o
     INNER JOIN users u ON u.user_id = o.user_id
     LEFT JOIN addresses a ON a.address_id = o.address_id
     LEFT JOIN payments p ON p.order_id = o.order_id AND p.status = 'SUCCESS'
     WHERE o.order_id = ?
     ORDER BY p.paid_at DESC
     LIMIT 1`,
    [orderId]
  );

  if (!orderRows.length) throw new Error('Order was not found for email delivery.');

  const [items] = await pool.execute(
    `SELECT product_name, sku, size, color, unit_price, quantity, line_total
     FROM order_items
     WHERE order_id = ?
     ORDER BY order_item_id`,
    [orderId]
  );

  return { order: orderRows[0], items };
}

function buildEmailHtml(eventType, order, items) {
  const isReceipt = eventType === 'PAYMENT_RECEIPT';
  const rows = items.map((item) => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #333;color:#eee">
        ${escapeHtml(item.product_name)}
        <div style="color:#aaa;font-size:12px">SKU ${escapeHtml(item.sku)} · ${escapeHtml(item.size)} · ${escapeHtml(item.color)} · Qty ${Number(item.quantity)}</div>
      </td>
      <td style="padding:12px;border-bottom:1px solid #333;color:#eee;text-align:right">${money(item.line_total)}</td>
    </tr>`).join('');

  const paymentBlock = isReceipt
    ? `<p style="color:#ddd">Payment reference: <strong>${escapeHtml(order.transaction_ref || 'Razorpay')}</strong></p>
       <p style="color:#ddd">Paid on: ${escapeHtml(order.paid_at || '')}</p>`
    : '<p style="color:#bbb">Your payment has been verified and your order is confirmed.</p>';

  return `
  <!doctype html>
  <html>
    <body style="margin:0;background:#0b0b0b;color:#fff;font-family:Arial,sans-serif;padding:28px">
      <div style="max-width:640px;margin:auto;background:#151515;border:1px solid #303030;border-radius:16px;padding:28px">
        <p style="letter-spacing:6px;font-size:14px;color:#aaa">V A G E</p>
        <h1 style="font-size:25px;margin:24px 0 8px">${isReceipt ? 'Payment receipt' : 'Order confirmed'}</h1>
        <p style="color:#bbb">Hi ${escapeHtml(order.full_name)},</p>
        ${paymentBlock}
        <p style="color:#ddd">Order <strong>${escapeHtml(order.order_number)}</strong></p>
        <table style="width:100%;border-collapse:collapse;margin:22px 0">
          <tbody>${rows}</tbody>
        </table>
        <table style="width:100%;color:#ddd">
          <tr><td style="padding:6px 0">Subtotal</td><td style="text-align:right">${money(order.subtotal)}</td></tr>
          <tr><td style="padding:6px 0">Membership discount</td><td style="text-align:right">− ${money(order.membership_discount_amount)}</td></tr>
          <tr><td style="padding:6px 0">Coupon discount</td><td style="text-align:right">− ${money(order.coupon_discount_amount)}</td></tr>
          <tr><td style="padding:6px 0">Delivery</td><td style="text-align:right">${money(order.shipping_amount)}</td></tr>
          <tr><td style="padding:12px 0;border-top:1px solid #555;font-size:18px;font-weight:bold">Total paid</td><td style="padding:12px 0;border-top:1px solid #555;text-align:right;font-size:18px;font-weight:bold">${money(order.total_amount)}</td></tr>
        </table>
        <div style="border-top:1px solid #333;margin-top:24px;padding-top:18px;color:#aaa;font-size:13px">
          <p>Shipping to: ${escapeHtml(order.recipient_name || order.full_name)}</p>
          <p>${escapeHtml(order.address_line1 || '')} ${escapeHtml(order.address_line2 || '')}</p>
          <p>${escapeHtml(order.city || '')}, ${escapeHtml(order.state_name || '')} ${escapeHtml(order.postal_code || '')}, ${escapeHtml(order.country || 'India')}</p>
          <p>Thank you for shopping with VAGE.</p>
        </div>
      </div>
    </body>
  </html>`;
}

async function dispatchOne(outboxRow) {
  const pool = getPool();
  const [claim] = await pool.execute(
    `UPDATE email_outbox
     SET status = 'PROCESSING', attempts = attempts + 1, last_error = NULL
     WHERE email_outbox_id = ? AND status IN ('PENDING','FAILED')`,
    [outboxRow.email_outbox_id]
  );

  if (claim.affectedRows !== 1) return { id: outboxRow.email_outbox_id, status: 'SKIPPED' };

  try {
    const payload = typeof outboxRow.payload === 'string'
      ? JSON.parse(outboxRow.payload)
      : outboxRow.payload;
    const orderId = Number(payload?.orderId);
    const { order, items } = await loadOrderEmailData(orderId);
    const from = process.env.EMAIL_FROM;
    if (!from) throw new Error('EMAIL_FROM is not configured.');

    const eventType = outboxRow.event_type;
    const isReceipt = eventType === 'PAYMENT_RECEIPT';
    const { data, error } = await getResend().emails.send(
      {
        from,
        to: [outboxRow.recipient_email],
        replyTo: process.env.EMAIL_REPLY_TO || undefined,
        subject: outboxRow.subject,
        html: buildEmailHtml(eventType, order, items),
        text: isReceipt
          ? `Payment received for VAGE order ${order.order_number}. Total: ${money(order.total_amount)}. Payment reference: ${order.transaction_ref || 'Razorpay'}.`
          : `Your VAGE order ${order.order_number} is confirmed. Total: ${money(order.total_amount)}.`,
      },
      { idempotencyKey: outboxRow.dedupe_key }
    );

    if (error) throw new Error(error.message || 'Resend failed to send the email.');

    await pool.execute(
      `UPDATE email_outbox
       SET status = 'SENT', provider_message_id = ?, sent_at = NOW(), last_error = NULL
       WHERE email_outbox_id = ?`,
      [data?.id || null, outboxRow.email_outbox_id]
    );
    return { id: outboxRow.email_outbox_id, status: 'SENT', providerMessageId: data?.id || null };
  } catch (error) {
    const message = String(error?.message || 'Email delivery failed.').slice(0, 950);
    await pool.execute(
      `UPDATE email_outbox SET status = 'FAILED', last_error = ?
       WHERE email_outbox_id = ?`,
      [message, outboxRow.email_outbox_id]
    );
    return { id: outboxRow.email_outbox_id, status: 'FAILED', error: message };
  }
}

/** Safe to call repeatedly: unique dedupe keys + Resend idempotency prevent duplicates. */
export async function dispatchPaidOrderEmails(orderId) {
  const pool = getPool();
  const numericId = Number(orderId);
  const [rows] = await pool.execute(
    `SELECT email_outbox_id, dedupe_key, event_type, recipient_email,
            subject, payload, status
     FROM email_outbox
     WHERE dedupe_key IN (?, ?)
       AND status IN ('PENDING','FAILED')
     ORDER BY email_outbox_id`,
    [`order-confirmation/${numericId}`, `payment-receipt/${numericId}`]
  );

  const results = [];
  for (const row of rows) results.push(await dispatchOne(row));
  return results;
}

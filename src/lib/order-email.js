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

function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPaidDate(value) {
  if (!value) return 'Payment verified';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

/** Call inside the same DB transaction that marks the order as paid. */
export async function enqueuePaidOrderEmails(connection, order) {
  const orderId = Number(order.order_id);
  const orderNumber = String(order.order_number);
  const recipient = String(order.email || '').trim().toLowerCase();

  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !recipient) {
    throw new Error('A valid order ID and customer email are required to queue order emails.');
  }

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
        o.membership_discount_amount, o.shipping_amount, o.delivery_method,
        o.total_amount, o.created_at,
        u.full_name, COALESCE(NULLIF(o.contact_email, ''), u.email) AS email,
        a.recipient_name, a.phone, a.address_line1, a.address_line2,
        a.city, a.state_name, a.postal_code, a.country,
        p.transaction_ref, p.payment_method, p.paid_at,
        g.gateway AS payment_provider
     FROM orders o
     INNER JOIN users u ON u.user_id = o.user_id
     LEFT JOIN addresses a ON a.address_id = o.address_id
     LEFT JOIN payments p ON p.order_id = o.order_id AND p.status = 'SUCCESS'
     LEFT JOIN order_payment_gateways g ON g.payment_id = p.payment_id
     WHERE o.order_id = ?
     ORDER BY p.paid_at DESC
     LIMIT 1`,
    [orderId]
  );

  if (!orderRows.length) throw new Error('Order was not found for email delivery.');
  if (orderRows[0].payment_status !== 'PAID') {
    throw new Error('Order emails are sent only after the payment is confirmed.');
  }

  const [items] = await pool.execute(
    `SELECT product_name, sku, size, color, unit_price, quantity, line_total
     FROM order_items
     WHERE order_id = ?
     ORDER BY order_item_id`,
    [orderId]
  );

  if (!items.length) throw new Error('No order items were found for email delivery.');
  return { order: orderRows[0], items };
}

function buildEmailContent(eventType, order, items) {
  const isReceipt = eventType === 'PAYMENT_RECEIPT';
  const title = isReceipt ? 'Payment receipt' : 'Your order is confirmed';
  const intro = isReceipt
    ? 'We have successfully recorded your payment. Keep this email as your receipt.'
    : 'Thank you for choosing VAGE. Your order is confirmed and is being prepared.';
  const paymentProvider = String(order.payment_provider || order.payment_method || 'DEMO').toUpperCase();
  const paymentReference = order.transaction_ref || (
    paymentProvider === 'DEMO' ? 'DEMO-SIMULATED' : 'Recorded by payment provider'
  );
  const paymentMethod = String(order.payment_method || paymentProvider).replaceAll('_', ' ');

  const htmlItems = items.map((item) => `
    <tr>
      <td style="padding:14px 10px;border-bottom:1px solid #303030;color:#eee">
        <strong>${escapeHtml(item.product_name)}</strong>
        <div style="color:#aaa;font-size:12px;margin-top:5px">
          SKU ${escapeHtml(item.sku)} · ${escapeHtml(item.size)} · ${escapeHtml(item.color)} · Qty ${Number(item.quantity)}
        </div>
        <div style="color:#aaa;font-size:12px;margin-top:3px">
          ${money(item.unit_price)} each
        </div>
      </td>
      <td style="padding:14px 10px;border-bottom:1px solid #303030;color:#eee;text-align:right;white-space:nowrap">
        ${money(item.line_total)}
      </td>
    </tr>`).join('');

  const plainItems = items.map((item) =>
    `- ${Number(item.quantity)} x ${item.product_name} (${item.size}, ${item.color}; SKU ${item.sku}) — ${money(item.line_total)}`
  ).join('\n');

  const address = [
    order.recipient_name || order.full_name,
    order.address_line1,
    order.address_line2,
    [order.city, order.state_name, order.postal_code].filter(Boolean).join(', '),
    order.country || 'India',
    order.phone,
  ].filter(Boolean).map(escapeHtml).join('<br/>');

  const plainAddress = [
    order.recipient_name || order.full_name,
    order.address_line1,
    order.address_line2,
    [order.city, order.state_name, order.postal_code].filter(Boolean).join(', '),
    order.country || 'India',
    order.phone,
  ].filter(Boolean).join('\n');

  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
  <body style="margin:0;background:#090909;color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;padding:24px 12px">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(title)} — order ${escapeHtml(order.order_number)}</div>
    <div style="max-width:640px;margin:0 auto;background:#151515;border:1px solid #303030;border-radius:16px;overflow:hidden">
      <div style="padding:28px 30px;border-bottom:1px solid #303030;background:#101010">
        <div style="font-size:15px;letter-spacing:7px;color:#bdbdbd;font-weight:bold">V A G E</div>
        <h1 style="font-size:25px;line-height:1.25;margin:24px 0 8px;color:#fff">${escapeHtml(title)}</h1>
        <p style="margin:0;color:#bdbdbd;line-height:1.6;font-size:14px">${escapeHtml(intro)}</p>
      </div>
      <div style="padding:26px 30px">
        <p style="color:#ddd;margin:0 0 8px">Hi ${escapeHtml(order.full_name)},</p>
        <p style="color:#aaa;font-size:13px;margin:0 0 22px">Order number<br/><strong style="display:inline-block;margin-top:5px;color:#fff;font-size:17px;letter-spacing:1px">${escapeHtml(order.order_number)}</strong></p>

        <h2 style="font-size:15px;color:#fff;margin:24px 0 8px">Items in your order</h2>
        <table role="presentation" style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th align="left" style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#888;padding:8px 10px">Product</th>
            <th align="right" style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#888;padding:8px 10px">Amount</th>
          </tr></thead>
          <tbody>${htmlItems}</tbody>
        </table>

        <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:18px;color:#ccc;font-size:13px">
          <tr><td style="padding:7px 0">Subtotal</td><td align="right">${money(order.subtotal)}</td></tr>
          <tr><td style="padding:7px 0">Membership discount</td><td align="right">− ${money(order.membership_discount_amount)}</td></tr>
          <tr><td style="padding:7px 0">Coupon discount</td><td align="right">− ${money(order.coupon_discount_amount)}</td></tr>
          <tr><td style="padding:7px 0">Delivery (${escapeHtml(order.delivery_method || 'Standard')})</td><td align="right">${money(order.shipping_amount)}</td></tr>
          <tr><td style="padding:15px 0 5px;border-top:1px solid #555;color:#fff;font-weight:bold;font-size:17px">${isReceipt ? 'Total paid' : 'Order total'}</td><td align="right" style="padding:15px 0 5px;border-top:1px solid #555;color:#fff;font-weight:bold;font-size:17px">${money(order.total_amount)}</td></tr>
        </table>

        <div style="margin-top:26px;padding:18px;background:#101010;border:1px solid #303030;border-radius:10px">
          <h2 style="font-size:14px;color:#fff;margin:0 0 12px">Payment details</h2>
          <p style="font-size:13px;color:#bbb;margin:6px 0">Method: <strong style="color:#eee">${escapeHtml(paymentMethod)}</strong></p>
          <p style="font-size:13px;color:#bbb;margin:6px 0">Provider: <strong style="color:#eee">${escapeHtml(paymentProvider)}</strong></p>
          <p style="font-size:13px;color:#bbb;margin:6px 0">Reference: <strong style="color:#eee">${escapeHtml(paymentReference)}</strong></p>
          <p style="font-size:13px;color:#bbb;margin:6px 0">Paid on: <strong style="color:#eee">${escapeHtml(formatPaidDate(order.paid_at))}</strong></p>
        </div>

        <div style="margin-top:22px;padding-top:18px;border-top:1px solid #303030">
          <h2 style="font-size:14px;color:#fff;margin:0 0 10px">Shipping address</h2>
          <p style="font-size:13px;line-height:1.7;color:#bbb;margin:0">${address}</p>
        </div>
      </div>
      <div style="padding:20px 30px;background:#101010;border-top:1px solid #303030;color:#888;font-size:12px;line-height:1.6">
        <p style="margin:0 0 6px;color:#ddd;letter-spacing:3px">V A G E</p>
        <p style="margin:0">Thank you for shopping with VAGE Clothing.</p>
        <p style="margin:5px 0 0">This is an automated transactional email. Please contact support if you need help with your order.</p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    `VAGE — ${title}`,
    `Hi ${order.full_name},`,
    `Order: ${order.order_number}`,
    '',
    'ORDER ITEMS',
    plainItems,
    '',
    `Subtotal: ${money(order.subtotal)}`,
    `Membership discount: -${money(order.membership_discount_amount)}`,
    `Coupon discount: -${money(order.coupon_discount_amount)}`,
    `Delivery: ${money(order.shipping_amount)}`,
    `${isReceipt ? 'Total paid' : 'Order total'}: ${money(order.total_amount)}`,
    '',
    'PAYMENT DETAILS',
    `Method: ${paymentMethod}`,
    `Provider: ${paymentProvider}`,
    `Reference: ${paymentReference}`,
    `Paid on: ${formatPaidDate(order.paid_at)}`,
    '',
    'SHIPPING ADDRESS',
    plainAddress,
    '',
    'Thank you for shopping with VAGE Clothing.',
  ].join('\n');

  return { html, text };
}

async function dispatchOne(outboxRow) {
  const pool = getPool();
  const [claim] = await pool.execute(
    `UPDATE email_outbox
     SET status = 'PROCESSING', attempts = attempts + 1, last_error = NULL
     WHERE email_outbox_id = ?
       AND (
         status IN ('PENDING','FAILED')
         OR (status = 'PROCESSING' AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE))
       )`,
    [outboxRow.email_outbox_id]
  );

  if (claim.affectedRows !== 1) {
    return { id: outboxRow.email_outbox_id, status: 'SKIPPED' };
  }

  try {
    const payload = typeof outboxRow.payload === 'string'
      ? JSON.parse(outboxRow.payload)
      : outboxRow.payload;
    const orderId = Number(payload?.orderId);
    const { order, items } = await loadOrderEmailData(orderId);
    const { user: sender, contactTo } = getVageMailboxConfig();

    if (!['ORDER_CONFIRMATION', 'PAYMENT_RECEIPT'].includes(outboxRow.event_type)) {
      throw new Error(`Unsupported transactional email event: ${outboxRow.event_type}`);
    }

    const { html, text } = buildEmailContent(outboxRow.event_type, order, items);
    const eventSlug = outboxRow.event_type.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const sent = await sendVageEmail({
      to: outboxRow.recipient_email,
      replyTo: contactTo,
      subject: outboxRow.subject,
      html,
      text,
      messageId: `<vage-${eventSlug}-${orderId}@${sender.split('@')[1]}>`,
    });

    if (!sent.messageId) throw new Error('Gmail SMTP did not return a message ID.');

    await pool.execute(
      `UPDATE email_outbox
       SET status = 'SENT', provider_message_id = ?, sent_at = NOW(), last_error = NULL
       WHERE email_outbox_id = ?`,
      [sent.messageId, outboxRow.email_outbox_id]
    );

    return {
      id: outboxRow.email_outbox_id,
      eventType: outboxRow.event_type,
      status: 'SENT',
      providerMessageId: sent.messageId,
    };
  } catch (error) {
    const message = String(error?.message || 'Email delivery failed.').slice(0, 950);
    await pool.execute(
      `UPDATE email_outbox
       SET status = 'FAILED', last_error = ?
       WHERE email_outbox_id = ?`,
      [message, outboxRow.email_outbox_id]
    );
    return {
      id: outboxRow.email_outbox_id,
      eventType: outboxRow.event_type,
      status: 'FAILED',
      error: message,
    };
  }
}

/** Safe to call repeatedly: unique outbox keys and atomic outbox claims reduce duplicate sends. */
export async function dispatchPaidOrderEmails(orderId) {
  const pool = getPool();
  const numericId = Number(orderId);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    throw new Error('A valid order ID is required to dispatch order emails.');
  }

  // Recreate missing outbox rows for older PAID orders created before email
  // queuing was enabled (INSERT IGNORE keeps this safe under concurrent retries).
  const [paidOrders] = await pool.execute(
    `SELECT o.order_id, o.order_number,
            COALESCE(NULLIF(o.contact_email, ''), u.email) AS email
     FROM orders o
     INNER JOIN users u ON u.user_id = o.user_id
     WHERE o.order_id = ? AND o.payment_status = 'PAID'
     LIMIT 1`,
    [numericId]
  );
  if (!paidOrders.length) {
    throw new Error('Transactional order emails can only be queued for a paid order.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await enqueuePaidOrderEmails(connection, paidOrders[0]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const [rows] = await pool.execute(
    `SELECT email_outbox_id, dedupe_key, event_type, recipient_email,
            subject, payload, status
     FROM email_outbox
     WHERE dedupe_key IN (?, ?)
       AND (
         status IN ('PENDING','FAILED')
         OR (status = 'PROCESSING' AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE))
       )
     ORDER BY email_outbox_id`,
    [`order-confirmation/${numericId}`, `payment-receipt/${numericId}`]
  );

  const results = [];
  for (const row of rows) results.push(await dispatchOne(row));
  return results;
}

/**
 * Scheduled worker: retries failed email deliveries no more than five times
 * automatically, with a 15-minute delay. Customers may still manually retry
 * a paid order from the order page.
 */
export async function dispatchPendingEmails(limit = 20) {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const [rows] = await pool.execute(
    `SELECT email_outbox_id, dedupe_key, event_type, recipient_email,
            subject, payload, status
     FROM email_outbox
     WHERE status = 'PENDING'
        OR (
          status = 'FAILED'
          AND attempts < 5
          AND updated_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
        )
        OR (
          status = 'PROCESSING'
          AND attempts < 5
          AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
        )
     ORDER BY email_outbox_id
     LIMIT ?`,
    [safeLimit]
  );

  const results = [];
  for (const row of rows) results.push(await dispatchOne(row));
  return { checked: rows.length, results };
}

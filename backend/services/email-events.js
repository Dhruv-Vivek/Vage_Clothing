import 'server-only';

/**
 * EMBEDDED MYSQL: queues transactional email events using INSERT/UPDATE statements against the email outbox tables.
 * See backend/README.md for the database/backend walkthrough.
 */

import { getPool } from '@/lib/db';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);
const money = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(v || 0));
const date = (v) => {
  if (!v) return '—';
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(d);
};
const p = (html) => `<p style="color:#ddd;line-height:1.6">${html}</p>`;
function shell(title, body) {
  return `<!doctype html><html lang="en"><body style="margin:0;background:#0b0b0b;color:#fff;font-family:Arial,sans-serif;padding:28px"><div style="max-width:640px;margin:auto;background:#151515;border:1px solid #303030;border-radius:16px;padding:28px"><p style="letter-spacing:6px;color:#aaa">V A G E</p><h1>${esc(title)}</h1>${body}<p style="border-top:1px solid #333;margin-top:24px;padding-top:18px;color:#aaa;font-size:13px">Thank you for shopping with VAGE.</p></div></body></html>`;
}
async function insertOutbox(connection, key, type, email, subject, payload) {
  await connection.execute(
    `INSERT IGNORE INTO email_outbox (dedupe_key,event_type,recipient_email,subject,payload,status)
     VALUES (?,?,?,?,?,'PENDING')`,
    [key,type,email,subject,JSON.stringify(payload)]
  );
  return key;
}
async function getOrderRecipient(connection, orderId) {
  const [rows] = await connection.execute(
    `SELECT o.order_number, COALESCE(NULLIF(o.contact_email,''),u.email) AS email
       FROM orders o INNER JOIN users u ON u.user_id=o.user_id WHERE o.order_id=? LIMIT 1`,
    [orderId]
  );
  if (!rows.length || !rows[0].email) throw new Error('Customer email not found for order notification.');
  return rows[0];
}

const ORDER_EVENTS = {
  ORDER_SHIPPED: ['order-shipped', (n) => `Your VAGE order ${n} has shipped`],
  ORDER_DELIVERED: ['order-delivered', (n) => `Your VAGE order ${n} was delivered`],
  ORDER_CANCELLED: ['order-cancelled', (n) => `Your VAGE order ${n} was cancelled`],
};

export async function enqueueOrderEvent(connection, orderId, eventType) {
  const config = ORDER_EVENTS[eventType];
  if (!config) throw new Error(`Unknown order notification event: ${eventType}`);
  const order = await getOrderRecipient(connection, orderId);
  return insertOutbox(connection, `${config[0]}/${orderId}`, eventType, order.email,
    config[1](order.order_number), { orderId: Number(orderId) });
}

export async function enqueueReturnEvent(connection, { returnId, orderId, status }) {
  const order = await getOrderRecipient(connection, orderId);
  return insertOutbox(connection, `return-status/${returnId}/${status}`, 'RETURN_STATUS',
    order.email, `Return update for VAGE order ${order.order_number}`,
    { orderId: Number(orderId), returnId: Number(returnId), status });
}

export async function enqueueMembershipActivated(connection, { paymentId, userId }) {
  const [users] = await connection.execute('SELECT email FROM users WHERE user_id=? LIMIT 1', [userId]);
  if (!users.length || !users[0].email) throw new Error('Member email not found.');
  return insertOutbox(connection, `membership-activated/${paymentId}`, 'MEMBERSHIP_ACTIVATED',
    users[0].email, 'Your VAGE membership is active', { paymentId: Number(paymentId) });
}

export const NOTIFICATION_EVENTS = new Set([
  'ORDER_SHIPPED','ORDER_DELIVERED','ORDER_CANCELLED',
  'RETURN_STATUS','MEMBERSHIP_ACTIVATED','MEMBERSHIP_EXPIRY_REMINDER',
]);

/** Queue the 7-day and 1-day reminder only once per membership and reminder window. */
export async function queueMembershipExpiryReminders(limit = 100) {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  let queued = 0;
  for (const days of [7, 1]) {
    const [rows] = await pool.execute(
      `SELECT um.membership_id, u.email, COALESCE(mp.display_name,mp.plan_name,mp.plan_code) AS plan_name
         FROM user_memberships um
         INNER JOIN membership_plans mp ON mp.plan_id=um.plan_id
         INNER JOIN users u ON u.user_id=um.user_id
        WHERE um.status='ACTIVE' AND um.starts_at<=NOW()
          AND um.expires_at>DATE_ADD(NOW(),INTERVAL ? DAY)
          AND um.expires_at<=DATE_ADD(NOW(),INTERVAL ? DAY)
        ORDER BY um.expires_at LIMIT ?`,
      [days - 1,days,safeLimit]
    );
    for (const row of rows) {
      const [result] = await pool.execute(
        `INSERT IGNORE INTO email_outbox
           (dedupe_key,event_type,recipient_email,subject,payload,status)
         VALUES (?,'MEMBERSHIP_EXPIRY_REMINDER',?,?,?,'PENDING')`,
        [`membership-expiry/${Number(row.membership_id)}/${days}d`,row.email,
         `Your VAGE ${row.plan_name} membership expires soon`,
         JSON.stringify({membershipId:Number(row.membership_id),reminderDays:days})]
      );
      queued += Number(result.affectedRows || 0);
    }
  }
  return { queued };
}

async function renderOrderEvent(type, payload) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT o.order_number,o.payment_status,o.total_amount,o.delivery_method,
            u.full_name,a.address_line1,a.address_line2,a.city,a.state_name,a.postal_code
       FROM orders o INNER JOIN users u ON u.user_id=o.user_id
       LEFT JOIN addresses a ON a.address_id=o.address_id
      WHERE o.order_id=? LIMIT 1`,
    [Number(payload.orderId)]
  );
  if (!rows.length) throw new Error('Order not found for notification.');
  const order = rows[0];
  const [items] = await pool.execute(
    'SELECT product_name,size,color,quantity,line_total FROM order_items WHERE order_id=? ORDER BY order_item_id',
    [Number(payload.orderId)]
  );
  const itemHtml = items.map((item) => `<tr><td style="padding:10px;border-bottom:1px solid #333;color:#eee">${esc(item.product_name)} <span style="color:#aaa;font-size:12px">${esc(item.size)} · ${esc(item.color)} · Qty ${Number(item.quantity)}</span></td><td style="padding:10px;border-bottom:1px solid #333;text-align:right;color:#eee">${money(item.line_total)}</td></tr>`).join('');
  const table = `<table style="width:100%;border-collapse:collapse">${itemHtml}</table>`;
  const address = esc([order.address_line1,order.address_line2,order.city,order.state_name,order.postal_code].filter(Boolean).join(', '));
  const hello = p(`Hi ${esc(order.full_name)},`);
  if (type==='ORDER_SHIPPED') return {html:shell('Your order is on its way',hello+p(`Order <strong>${esc(order.order_number)}</strong> has shipped.`)+table+p(`Shipping address: ${address}`)),text:`Your VAGE order ${order.order_number} has shipped.`};
  if (type==='ORDER_DELIVERED') return {html:shell('Your order was delivered',hello+p(`Order <strong>${esc(order.order_number)}</strong> was delivered. We hope you love it.`)+table+p('You can request a return from your order page within the return window.')),text:`Your VAGE order ${order.order_number} was delivered.`};
  const refunded=order.payment_status==='REFUNDED';
  return {html:shell('Your order was cancelled',hello+p(`Order <strong>${esc(order.order_number)}</strong> has been cancelled.`)+p(refunded?`A refund of <strong>${money(order.total_amount)}</strong> has been issued to your original payment method.`:'No payment was taken for this order.')+table),text:`Your VAGE order ${order.order_number} was cancelled.${refunded?' A refund was issued.':''}`};
}

const RETURN_COPY={
  REQUESTED:['Return request received','We have received your return request and will review it shortly.'],
  APPROVED:['Return approved','Your return was approved. Please follow the instructions from VAGE support.'],
  REJECTED:['Return not approved','Unfortunately, we could not approve this return request.'],
  RECEIVED:['Return received','We have received your returned item. Your refund is being processed.'],
  REFUNDED:['Refund issued','Your refund has been issued to your original payment method.'],
};
async function renderReturnEvent(payload) {
  const [rows]=await getPool().execute(
    `SELECT r.quantity,r.reason,r.status,r.resolution_notes,oi.product_name,oi.size,oi.color,o.order_number,u.full_name
       FROM returns r INNER JOIN order_items oi ON oi.order_item_id=r.order_item_id
       INNER JOIN orders o ON o.order_id=oi.order_id INNER JOIN users u ON u.user_id=o.user_id
      WHERE r.return_id=? LIMIT 1`,
    [Number(payload.returnId)]
  );
  if(!rows.length) throw new Error('Return not found for notification.');
  const row=rows[0]; const [title,copy]=RETURN_COPY[payload.status]||RETURN_COPY[row.status]||RETURN_COPY.REQUESTED;
  const notes=payload.status==='REJECTED'&&row.resolution_notes?p(`Team note: ${esc(row.resolution_notes)}`):'';
  return {html:shell(title,p(`Hi ${esc(row.full_name)},`)+p(copy)+p(`Order <strong>${esc(row.order_number)}</strong>: ${Number(row.quantity)} × ${esc(row.product_name)} (${esc(row.size)}, ${esc(row.color)})`)+notes),text:`${title}. Order ${row.order_number}.`};
}

async function renderMembershipEvent(type,payload) {
  if(type==='MEMBERSHIP_ACTIVATED') {
    const [rows]=await getPool().execute(
      `SELECT COALESCE(mp.display_name,mp.plan_name,mp.plan_code) AS plan_name,
              mp.discount_percent,u.full_name,um.starts_at,um.expires_at,mpt.amount
         FROM membership_payment_transactions mpt
         INNER JOIN user_memberships um ON um.membership_id=mpt.membership_id
         INNER JOIN membership_plans mp ON mp.plan_id=um.plan_id
         INNER JOIN users u ON u.user_id=um.user_id
        WHERE mpt.membership_payment_id=? AND mpt.status='CAPTURED' LIMIT 1`,
      [Number(payload.paymentId)]
    );
    if(!rows.length) throw new Error('Captured membership payment not found.');
    const row=rows[0];
    return {html:shell('Your membership is active',p(`Hi ${esc(row.full_name)},`)+p(`Your <strong>${esc(row.plan_name)}</strong> membership is active and provides ${Number(row.discount_percent)}% off eligible products.`)+p(`Amount paid: ${money(row.amount)}<br/>Valid from ${date(row.starts_at)} until ${date(row.expires_at)}.`)),text:`Your VAGE ${row.plan_name} membership is active until ${date(row.expires_at)}.`};
  }
  const [rows]=await getPool().execute(
    `SELECT COALESCE(mp.display_name,mp.plan_name,mp.plan_code) AS plan_name,u.full_name,um.expires_at
       FROM user_memberships um INNER JOIN membership_plans mp ON mp.plan_id=um.plan_id
       INNER JOIN users u ON u.user_id=um.user_id
      WHERE um.membership_id=? AND um.status='ACTIVE' LIMIT 1`,
    [Number(payload.membershipId)]
  );
  if(!rows.length) throw new Error('Active membership not found for reminder.');
  const row=rows[0];
  return {html:shell('Your membership expires soon',p(`Hi ${esc(row.full_name)},`)+p(`Your <strong>${esc(row.plan_name)}</strong> membership expires on <strong>${date(row.expires_at)}</strong>. Renew from the Membership page to keep your benefits.`)),text:`Your VAGE ${row.plan_name} membership expires on ${date(row.expires_at)}.`};
}

export async function renderNotificationEmail(eventType,payload) {
  if(eventType==='RETURN_STATUS') return renderReturnEvent(payload);
  if(eventType==='MEMBERSHIP_ACTIVATED'||eventType==='MEMBERSHIP_EXPIRY_REMINDER') return renderMembershipEvent(eventType,payload);
  return renderOrderEvent(eventType,payload);
}

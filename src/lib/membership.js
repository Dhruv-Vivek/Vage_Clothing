import 'server-only';

import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/db';
import { getRazorpay, getRazorpayPublicKey } from '@/lib/razorpay';

const RENEWAL_WINDOW_DAYS = 30;

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapPlan(row) {
  return {
    planId: Number(row.plan_id),
    code: String(row.plan_code).toLowerCase(),
    name: row.display_name || row.plan_code,
    price: Number(row.price_amount),
    durationDays: Number(row.duration_days || 365),
    discountPercent: Number(row.discount_percent),
    freeShippingMinimum: Number(row.free_shipping_minimum || 0),
    freeShippingMethods: parseJsonArray(row.free_shipping_methods),
  };
}

export async function getMembershipPlans() {
  const [rows] = await getPool().execute(
    "SELECT plan_id, plan_code, display_name, price_amount, duration_days, discount_percent, free_shipping_minimum, free_shipping_methods " +
    "FROM membership_plans WHERE is_active = 1 AND price_amount > 0 ORDER BY discount_percent, plan_id"
  );
  return rows.map(mapPlan);
}

export async function getActiveMembershipForUser(userId) {
  const [rows] = await getPool().execute(
    "SELECT mp.plan_code, mp.display_name, mp.discount_percent, um.starts_at, um.expires_at " +
    "FROM user_memberships um INNER JOIN membership_plans mp ON mp.plan_id = um.plan_id " +
    "WHERE um.user_id = ? AND um.status = 'ACTIVE' AND um.starts_at <= NOW() AND um.expires_at > NOW() AND mp.is_active = 1 " +
    "ORDER BY um.expires_at DESC LIMIT 1",
    [userId]
  );
  if (!rows.length) return null;
  return {
    code: String(rows[0].plan_code).toLowerCase(),
    name: rows[0].display_name || rows[0].plan_code,
    discountPercent: Number(rows[0].discount_percent),
    startsAt: rows[0].starts_at,
    expiresAt: rows[0].expires_at,
  };
}

export async function getMembershipSnapshot(userId) {
  const pool = getPool();
  await pool.execute(
    "UPDATE user_memberships SET status = 'EXPIRED' " +
    "WHERE user_id = ? AND status = 'ACTIVE' AND expires_at <= NOW()",
    [userId]
  );

  const [currentRows] = await pool.execute(
    "SELECT um.membership_id, um.purchase_id, um.status, um.starts_at, um.expires_at, " +
    "DATEDIFF(um.expires_at, NOW()) AS days_left, mp.plan_id, mp.plan_code, mp.display_name, " +
    "mp.discount_percent, mp.free_shipping_minimum, mp.free_shipping_methods " +
    "FROM user_memberships um INNER JOIN membership_plans mp ON mp.plan_id = um.plan_id " +
    "WHERE um.user_id = ? AND um.status = 'ACTIVE' AND um.starts_at <= NOW() AND um.expires_at > NOW() " +
    "ORDER BY um.expires_at DESC LIMIT 1",
    [userId]
  );
  const [queuedRows] = await pool.execute(
    "SELECT um.membership_id, um.purchase_id, um.starts_at, um.expires_at, mp.plan_code, mp.display_name " +
    "FROM user_memberships um INNER JOIN membership_plans mp ON mp.plan_id = um.plan_id " +
    "WHERE um.user_id = ? AND um.status = 'ACTIVE' AND um.starts_at > NOW() ORDER BY um.starts_at LIMIT 1",
    [userId]
  );
  const [historyRows] = await pool.execute(
    "SELECT um.membership_id, um.status, um.starts_at, um.expires_at, um.cancelled_at, " +
    "mp.plan_code, mp.display_name, mp.discount_percent, mpur.amount, mpur.purchase_type " +
    "FROM user_memberships um INNER JOIN membership_plans mp ON mp.plan_id = um.plan_id " +
    "LEFT JOIN membership_purchases mpur ON mpur.purchase_id = um.purchase_id " +
    "WHERE um.user_id = ? ORDER BY um.starts_at DESC LIMIT 25",
    [userId]
  );
  const [purchaseRows] = await pool.execute(
    "SELECT purchase_id, purchase_type, amount, currency, status, created_at, paid_at " +
    "FROM membership_purchases WHERE user_id = ? ORDER BY created_at DESC LIMIT 10",
    [userId]
  );

  const current = currentRows[0] || null;
  const queued = queuedRows[0] || null;
  return {
    current: current ? {
      membershipId: Number(current.membership_id),
      purchaseId: current.purchase_id === null ? null : Number(current.purchase_id),
      code: String(current.plan_code).toLowerCase(),
      name: current.display_name || current.plan_code,
      discountPercent: Number(current.discount_percent),
      startsAt: current.starts_at,
      expiresAt: current.expires_at,
      daysLeft: Number(current.days_left),
      freeShippingMinimum: Number(current.free_shipping_minimum || 0),
      freeShippingMethods: parseJsonArray(current.free_shipping_methods),
    } : null,
    queued: queued ? {
      membershipId: Number(queued.membership_id),
      purchaseId: queued.purchase_id === null ? null : Number(queued.purchase_id),
      code: String(queued.plan_code).toLowerCase(),
      name: queued.display_name || queued.plan_code,
      startsAt: queued.starts_at,
      expiresAt: queued.expires_at,
    } : null,
    history: historyRows.map((row) => ({
      membershipId: Number(row.membership_id),
      code: String(row.plan_code).toLowerCase(),
      name: row.display_name || row.plan_code,
      status: row.status,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      cancelledAt: row.cancelled_at,
      amount: row.amount === null ? null : Number(row.amount),
      purchaseType: row.purchase_type || null,
    })),
    purchases: purchaseRows.map((row) => ({
      purchaseId: Number(row.purchase_id),
      purchaseType: row.purchase_type,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at,
      paidAt: row.paid_at,
    })),
  };
}

export async function findMembershipPurchaseForUser(userId, purchaseId) {
  const [rows] = await getPool().execute(
    "SELECT purchase_id, plan_id, gateway_order_id, gateway_payment_id, amount, currency, status " +
    "FROM membership_purchases WHERE purchase_id = ? AND user_id = ? AND gateway = 'RAZORPAY' LIMIT 1",
    [purchaseId, userId]
  );
  return rows[0] || null;
}

export async function createMembershipPurchase(user, planCode, idempotencyKey) {
  const code = String(planCode || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,30}$/.test(code)) throw new Error('Choose a valid membership plan.');
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(String(idempotencyKey || ''))) {
    throw new Error('Refresh the page and try again. The purchase request key is invalid.');
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  let purchaseId;
  let plan;
  let purchaseType = 'NEW';

  try {
    await connection.beginTransaction();
    await connection.execute("SELECT user_id FROM users WHERE user_id = ? AND is_active = 1 FOR UPDATE", [user.id]);

    const [existingRows] = await connection.execute(
      "SELECT purchase_id, plan_id, gateway_order_id, amount, status " +
      "FROM membership_purchases WHERE user_id = ? AND idempotency_key = ? LIMIT 1 FOR UPDATE",
      [user.id, idempotencyKey]
    );
    if (existingRows.length) {
      const existing = existingRows[0];
      if (existing.status === 'FAILED') throw new Error('This purchase attempt failed. Start a new purchase.');
      if (!existing.gateway_order_id) throw new Error('This purchase is still being prepared. Please retry in a moment.');
      const [planRows] = await connection.execute(
        "SELECT plan_id, plan_code, display_name, price_amount, duration_days, discount_percent, free_shipping_minimum, free_shipping_methods " +
        "FROM membership_plans WHERE plan_id = ? LIMIT 1",
        [existing.plan_id]
      );
      plan = planRows[0];
      purchaseId = Number(existing.purchase_id);
      await connection.commit();
      return {
        purchaseId,
        amount: cents(existing.amount),
        currency: 'INR',
        razorpayOrderId: existing.gateway_order_id,
        keyId: getRazorpayPublicKey(),
        plan: mapPlan(plan),
        existing: true,
      };
    }

    const [planRows] = await connection.execute(
      "SELECT plan_id, plan_code, display_name, price_amount, duration_days, discount_percent, free_shipping_minimum, free_shipping_methods " +
      "FROM membership_plans WHERE LOWER(plan_code) = ? AND is_active = 1 AND price_amount > 0 LIMIT 1",
      [code]
    );
    if (!planRows.length) throw new Error('This membership plan is not available.');
    plan = planRows[0];

    const [currentRows] = await connection.execute(
      "SELECT plan_id, expires_at, (expires_at <= DATE_ADD(NOW(), INTERVAL ? DAY)) AS renewal_open " +
      "FROM user_memberships WHERE user_id = ? AND status = 'ACTIVE' AND starts_at <= NOW() AND expires_at > NOW() " +
      "ORDER BY expires_at DESC LIMIT 1 FOR UPDATE",
      [RENEWAL_WINDOW_DAYS, user.id]
    );
    if (currentRows.length) {
      if (Number(currentRows[0].plan_id) !== Number(plan.plan_id)) {
        throw new Error('You already have an active membership. Renew your current plan or wait until it expires before changing plans.');
      }
      if (!Boolean(currentRows[0].renewal_open)) {
        throw new Error('Renewal opens during the final 30 days of your membership.');
      }
      purchaseType = 'RENEWAL';
    }

    const [queuedRows] = await connection.execute(
      "SELECT membership_id FROM user_memberships WHERE user_id = ? AND status = 'ACTIVE' AND starts_at > NOW() LIMIT 1 FOR UPDATE",
      [user.id]
    );
    if (queuedRows.length) throw new Error('You already have a future membership renewal queued.');

    const [pendingRows] = await connection.execute(
      "SELECT purchase_id FROM membership_purchases WHERE user_id = ? AND status IN ('CREATED','AUTHORIZED') " +
      "AND created_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE) LIMIT 1 FOR UPDATE",
      [user.id]
    );
    if (pendingRows.length) throw new Error('You already have a membership payment in progress. Complete or close that checkout first.');

    const [insert] = await connection.execute(
      "INSERT INTO membership_purchases (user_id, plan_id, purchase_type, idempotency_key, amount, currency, status) " +
      "VALUES (?, ?, ?, ?, ?, 'INR', 'CREATED')",
      [user.id, plan.plan_id, purchaseType, idempotencyKey, Number(plan.price_amount)]
    );
    purchaseId = Number(insert.insertId);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  try {
    const gatewayOrder = await getRazorpay().orders.create({
      amount: cents(plan.price_amount),
      currency: 'INR',
      receipt: 'VG-MEM-' + purchaseId,
      notes: {
        vage_membership_purchase_id: String(purchaseId),
        vage_user_id: String(user.id),
        vage_plan_code: String(plan.plan_code),
      },
    });
    await pool.execute(
      "UPDATE membership_purchases SET gateway_order_id = ? WHERE purchase_id = ? AND status = 'CREATED'",
      [gatewayOrder.id, purchaseId]
    );
    return {
      purchaseId,
      amount: cents(plan.price_amount),
      currency: 'INR',
      razorpayOrderId: gatewayOrder.id,
      keyId: getRazorpayPublicKey(),
      plan: mapPlan(plan),
      existing: false,
    };
  } catch (error) {
    await pool.execute(
      "UPDATE membership_purchases SET status = 'FAILED' WHERE purchase_id = ? AND status = 'CREATED'",
      [purchaseId]
    ).catch(() => undefined);
    throw new Error('Unable to start membership payment. No membership was activated. Please try again.');
  }
}

export async function markMembershipPurchaseAuthorized({ purchaseId, gatewayPaymentId }) {
  const pool = getPool();
  const [result] = await pool.execute(
    "UPDATE membership_purchases SET gateway_payment_id = COALESCE(gateway_payment_id, ?), status = 'AUTHORIZED' " +
    "WHERE purchase_id = ? AND status IN ('CREATED','AUTHORIZED')",
    [gatewayPaymentId || null, purchaseId]
  );
  return { updated: result.affectedRows > 0, status: 'AUTHORIZED' };
}

export async function markMembershipPurchaseFailed(purchaseId) {
  const [result] = await getPool().execute(
    "UPDATE membership_purchases SET status = 'FAILED' WHERE purchase_id = ? AND status IN ('CREATED','AUTHORIZED')",
    [purchaseId]
  );
  return { updated: result.affectedRows > 0, status: 'FAILED' };
}

export async function markMembershipPurchaseCaptured({
  purchaseId,
  gatewayOrderId,
  gatewayPaymentId,
  amount,
  currency,
  signatureVerified = false,
}) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT purchase_id, user_id, plan_id, purchase_type, gateway_order_id, gateway_payment_id, amount, currency, status " +
      "FROM membership_purchases WHERE purchase_id = ? AND gateway = 'RAZORPAY' LIMIT 1 FOR UPDATE",
      [purchaseId]
    );
    if (!rows.length) throw new Error('Membership purchase was not found.');
    const purchase = rows[0];

    if (purchase.status === 'CAPTURED') {
      await connection.commit();
      return { purchaseId, status: 'CAPTURED', alreadyFinal: true };
    }
    if (purchase.status === 'FAILED') throw new Error('This membership purchase has already failed.');
    if (purchase.gateway_order_id !== gatewayOrderId) throw new Error('Payment order does not match this membership purchase.');
    if (purchase.gateway_payment_id && String(purchase.gateway_payment_id) !== String(gatewayPaymentId)) {
      throw new Error('A different payment is already linked to this membership purchase.');
    }
    if (Number(amount) !== cents(purchase.amount) || String(currency).toUpperCase() !== 'INR') {
      throw new Error('Captured membership payment amount or currency does not match the selected plan.');
    }

    await connection.execute("SELECT user_id FROM users WHERE user_id = ? FOR UPDATE", [purchase.user_id]);

    const [activeRows] = await connection.execute(
      "SELECT membership_id, plan_id, expires_at FROM user_memberships " +
      "WHERE user_id = ? AND status = 'ACTIVE' AND starts_at <= NOW() AND expires_at > NOW() " +
      "ORDER BY expires_at DESC LIMIT 1 FOR UPDATE",
      [purchase.user_id]
    );

    let startsAt = null;
    if (activeRows.length) {
      if (Number(activeRows[0].plan_id) !== Number(purchase.plan_id)) {
        throw new Error('The active membership changed before payment capture. Contact VAGE support before purchasing again.');
      }
      startsAt = activeRows[0].expires_at;
    }

    const [planRows] = await connection.execute(
      "SELECT duration_days FROM membership_plans WHERE plan_id = ? AND is_active = 1 LIMIT 1",
      [purchase.plan_id]
    );
    if (!planRows.length) throw new Error('The purchased membership plan is no longer active.');

    await connection.execute(
      "INSERT INTO user_memberships (user_id, plan_id, purchase_id, status, starts_at, expires_at) " +
      "VALUES (?, ?, ?, 'ACTIVE', COALESCE(?, NOW()), DATE_ADD(COALESCE(?, NOW()), INTERVAL ? DAY))",
      [purchase.user_id, purchase.plan_id, purchase.purchase_id, startsAt, startsAt, Number(planRows[0].duration_days)]
    );

    await connection.execute(
      "UPDATE membership_purchases SET gateway_payment_id = ?, status = 'CAPTURED', signature_verified = ?, paid_at = NOW() " +
      "WHERE purchase_id = ?",
      [gatewayPaymentId, signatureVerified ? 1 : 0, purchaseId]
    );

    await connection.commit();
    return { purchaseId, status: 'CAPTURED', activated: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function cancelQueuedMembership(userId, membershipId) {
  const [result] = await getPool().execute(
    "UPDATE user_memberships SET status = 'CANCELLED', cancelled_at = NOW() " +
    "WHERE membership_id = ? AND user_id = ? AND status = 'ACTIVE' AND starts_at > NOW()",
    [membershipId, userId]
  );
  if (result.affectedRows !== 1) {
    throw new Error('Only a future queued renewal can be cancelled. Current memberships remain active until their expiry; auto-renewal is not enabled.');
  }
  return { cancelled: true };
}

export async function getMembershipPurchaseOwner(userId, purchaseId) {
  const [rows] = await getPool().execute(
    "SELECT purchase_id, user_id, gateway_order_id, gateway_payment_id, amount, currency, status " +
    "FROM membership_purchases WHERE purchase_id = ? AND user_id = ? AND gateway = 'RAZORPAY' LIMIT 1",
    [purchaseId, userId]
  );
  return rows[0] || null;
}

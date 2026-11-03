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
    name: row.display_name || row.plan_name || row.plan_code,
    price: Number(row.price_amount ?? row.annual_price),
    durationDays: Number(row.duration_days || 365),
    discountPercent: Number(row.discount_percent),
    freeShippingMinimum: Number(row.free_shipping_minimum || 0),
    freeShippingMethods: parseJsonArray(row.free_shipping_methods),
    features: parseJsonArray(row.features),
  };
}

const PLAN_SELECT =
  "SELECT plan_id, plan_code, plan_name, annual_price, display_name, price_amount, duration_days, " +
  "discount_percent, free_shipping_minimum, free_shipping_methods, features " +
  "FROM membership_plans ";

export async function getMembershipPlans() {
  const [rows] = await getPool().execute(
    PLAN_SELECT + "WHERE is_active = 1 AND COALESCE(price_amount, annual_price) > 0 ORDER BY discount_percent, plan_id"
  );
  return rows.map(mapPlan);
}

export async function getActiveMembershipForUser(userId) {
  const [rows] = await getPool().execute(
    "SELECT mp.plan_code, COALESCE(mp.display_name, mp.plan_name) AS display_name, mp.discount_percent, um.starts_at, um.expires_at " +
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
    "WHERE user_id = ? AND status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at <= NOW()",
    [userId]
  );

  const baseSelect =
    "SELECT um.membership_id, um.status, um.starts_at, um.expires_at, um.cancelled_at, " +
    "mp.plan_id, mp.plan_code, COALESCE(mp.display_name, mp.plan_name) AS display_name, " +
    "mp.discount_percent, mp.free_shipping_minimum, mp.free_shipping_methods, " +
    "mpt.membership_payment_id, mpt.amount, mpt.purchase_type, mpt.status AS payment_status " +
    "FROM user_memberships um INNER JOIN membership_plans mp ON mp.plan_id = um.plan_id " +
    "LEFT JOIN membership_payment_transactions mpt ON mpt.membership_id = um.membership_id ";

  const [currentRows] = await pool.execute(
    baseSelect +
    "WHERE um.user_id = ? AND um.status = 'ACTIVE' AND um.starts_at <= NOW() AND um.expires_at > NOW() " +
    "ORDER BY um.expires_at DESC LIMIT 1",
    [userId]
  );
  const [queuedRows] = await pool.execute(
    "SELECT um.membership_id, um.starts_at, um.expires_at, mp.plan_code, " +
    "COALESCE(mp.display_name, mp.plan_name) AS display_name, mpt.membership_payment_id " +
    "FROM user_memberships um INNER JOIN membership_plans mp ON mp.plan_id = um.plan_id " +
    "LEFT JOIN membership_payment_transactions mpt ON mpt.membership_id = um.membership_id " +
    "WHERE um.user_id = ? AND um.status = 'ACTIVE' AND um.starts_at > NOW() ORDER BY um.starts_at LIMIT 1",
    [userId]
  );
  const [historyRows] = await pool.execute(
    baseSelect +
    "WHERE um.user_id = ? ORDER BY um.created_at DESC LIMIT 25",
    [userId]
  );
  const [paymentRows] = await pool.execute(
    "SELECT mpt.membership_payment_id, mpt.purchase_type, mpt.amount, mpt.currency, mpt.status, " +
    "mpt.created_at, mpt.paid_at, mp.plan_code, COALESCE(mp.display_name, mp.plan_name) AS display_name " +
    "FROM membership_payment_transactions mpt " +
    "INNER JOIN user_memberships um ON um.membership_id = mpt.membership_id " +
    "INNER JOIN membership_plans mp ON mp.plan_id = um.plan_id " +
    "WHERE um.user_id = ? ORDER BY mpt.created_at DESC LIMIT 10",
    [userId]
  );

  const current = currentRows[0] || null;
  const queued = queuedRows[0] || null;
  return {
    current: current ? {
      membershipId: Number(current.membership_id),
      paymentId: current.membership_payment_id === null ? null : Number(current.membership_payment_id),
      code: String(current.plan_code).toLowerCase(),
      name: current.display_name || current.plan_code,
      discountPercent: Number(current.discount_percent),
      startsAt: current.starts_at,
      expiresAt: current.expires_at,
      daysLeft: current.expires_at ? Math.max(0, Math.ceil((new Date(current.expires_at).getTime() - Date.now()) / 86400000)) : 0,
      freeShippingMinimum: Number(current.free_shipping_minimum || 0),
      freeShippingMethods: parseJsonArray(current.free_shipping_methods),
    } : null,
    queued: queued ? {
      membershipId: Number(queued.membership_id),
      paymentId: queued.membership_payment_id === null ? null : Number(queued.membership_payment_id),
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
      paymentStatus: row.payment_status || null,
    })),
    payments: paymentRows.map((row) => ({
      paymentId: Number(row.membership_payment_id),
      plan: row.display_name || row.plan_code,
      purchaseType: row.purchase_type,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at,
      paidAt: row.paid_at,
    })),
  };
}

export async function getMembershipPurchaseOwner(userId, paymentId) {
  const [rows] = await getPool().execute(
    "SELECT mpt.membership_payment_id, mpt.membership_id, mpt.gateway_order_id, mpt.gateway_payment_id, " +
    "mpt.amount, mpt.currency, mpt.status, um.user_id " +
    "FROM membership_payment_transactions mpt INNER JOIN user_memberships um ON um.membership_id = mpt.membership_id " +
    "WHERE mpt.membership_payment_id = ? AND um.user_id = ? AND mpt.gateway = 'RAZORPAY' LIMIT 1",
    [paymentId, userId]
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
  let paymentId;
  let membershipId;
  let plan;
  let purchaseType = 'NEW';
  const pendingOrderId = 'pending_' + randomUUID().replaceAll('-', '');

  try {
    await connection.beginTransaction();
    const [users] = await connection.execute(
      "SELECT user_id FROM users WHERE user_id = ? AND is_active = 1 FOR UPDATE",
      [user.id]
    );
    if (!users.length) throw new Error('Your account is unavailable. Please sign in again.');

    const [existingRows] = await connection.execute(
      "SELECT mpt.membership_payment_id, mpt.membership_id, mpt.gateway_order_id, mpt.amount, mpt.status, " +
      "mp.plan_id, mp.plan_code, mp.plan_name, mp.annual_price, mp.display_name, mp.price_amount, mp.duration_days, " +
      "mp.discount_percent, mp.free_shipping_minimum, mp.free_shipping_methods, mp.features " +
      "FROM membership_payment_transactions mpt " +
      "INNER JOIN user_memberships um ON um.membership_id = mpt.membership_id " +
      "INNER JOIN membership_plans mp ON mp.plan_id = um.plan_id " +
      "WHERE um.user_id = ? AND mpt.idempotency_key = ? LIMIT 1 FOR UPDATE",
      [user.id, idempotencyKey]
    );
    if (existingRows.length) {
      const existing = existingRows[0];
      if (existing.status === 'FAILED') throw new Error('This purchase attempt failed. Start a new purchase.');
      if (!existing.gateway_order_id || existing.gateway_order_id.startsWith('pending_')) {
        throw new Error('This purchase is still being prepared. Please retry in a moment.');
      }
      await connection.commit();
      return {
        purchaseId: Number(existing.membership_payment_id),
        membershipId: Number(existing.membership_id),
        amount: cents(existing.amount),
        currency: 'INR',
        razorpayOrderId: existing.gateway_order_id,
        keyId: getRazorpayPublicKey(),
        plan: mapPlan(existing),
        existing: true,
      };
    }

    const [planRows] = await connection.execute(
      PLAN_SELECT + "WHERE LOWER(plan_code) = ? AND is_active = 1 AND COALESCE(price_amount, annual_price) > 0 LIMIT 1",
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
      "SELECT mpt.membership_payment_id FROM membership_payment_transactions mpt " +
      "INNER JOIN user_memberships um ON um.membership_id = mpt.membership_id " +
      "WHERE um.user_id = ? AND mpt.status IN ('CREATED','AUTHORIZED') LIMIT 1 FOR UPDATE",
      [user.id]
    );
    if (pendingRows.length) throw new Error('You already have a membership payment in progress. Complete or close that checkout first.');

    const [membershipInsert] = await connection.execute(
      "INSERT INTO user_memberships (user_id, plan_id, status, starts_at, expires_at) VALUES (?, ?, 'PENDING', NULL, NULL)",
      [user.id, plan.plan_id]
    );
    membershipId = Number(membershipInsert.insertId);

    const [paymentInsert] = await connection.execute(
      "INSERT INTO membership_payment_transactions " +
      "(membership_id, gateway, gateway_order_id, amount, currency, status, purchase_type, idempotency_key) " +
      "VALUES (?, 'RAZORPAY', ?, ?, 'INR', 'CREATED', ?, ?)",
      [membershipId, pendingOrderId, Number(plan.price_amount ?? plan.annual_price), purchaseType, idempotencyKey]
    );
    paymentId = Number(paymentInsert.insertId);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  try {
    const price = Number(plan.price_amount ?? plan.annual_price);
    const gatewayOrder = await getRazorpay().orders.create({
      amount: cents(price),
      currency: 'INR',
      receipt: 'VG-MEM-' + paymentId,
      notes: {
        vage_membership_payment_id: String(paymentId),
        vage_membership_id: String(membershipId),
        vage_user_id: String(user.id),
        vage_plan_code: String(plan.plan_code),
      },
    });
    await pool.execute(
      "UPDATE membership_payment_transactions SET gateway_order_id = ? " +
      "WHERE membership_payment_id = ? AND gateway_order_id = ? AND status = 'CREATED'",
      [gatewayOrder.id, paymentId, pendingOrderId]
    );
    return {
      purchaseId: paymentId,
      membershipId,
      amount: cents(price),
      currency: 'INR',
      razorpayOrderId: gatewayOrder.id,
      keyId: getRazorpayPublicKey(),
      plan: mapPlan(plan),
      existing: false,
    };
  } catch (error) {
    await pool.execute(
      "UPDATE membership_payment_transactions SET status = 'FAILED' WHERE membership_payment_id = ? AND status = 'CREATED'",
      [paymentId]
    ).catch(() => undefined);
    await pool.execute(
      "UPDATE user_memberships SET status = 'FAILED' WHERE membership_id = ? AND status = 'PENDING'",
      [membershipId]
    ).catch(() => undefined);
    throw new Error('Unable to start membership payment. No membership was activated. Please try again.');
  }
}

export async function markMembershipPurchaseAuthorized({ purchaseId, gatewayPaymentId }) {
  const [result] = await getPool().execute(
    "UPDATE membership_payment_transactions SET gateway_payment_id = COALESCE(gateway_payment_id, ?), status = 'AUTHORIZED' " +
    "WHERE membership_payment_id = ? AND status IN ('CREATED','AUTHORIZED')",
    [gatewayPaymentId || null, purchaseId]
  );
  return { updated: result.affectedRows > 0, status: 'AUTHORIZED' };
}

export async function markMembershipPurchaseFailed(purchaseId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT membership_id FROM membership_payment_transactions WHERE membership_payment_id = ? FOR UPDATE",
      [purchaseId]
    );
    if (!rows.length) throw new Error('Membership payment was not found.');
    await connection.execute(
      "UPDATE membership_payment_transactions SET status = 'FAILED' WHERE membership_payment_id = ? AND status IN ('CREATED','AUTHORIZED')",
      [purchaseId]
    );
    await connection.execute(
      "UPDATE user_memberships SET status = 'FAILED' WHERE membership_id = ? AND status = 'PENDING'",
      [rows[0].membership_id]
    );
    await connection.commit();
    return { status: 'FAILED' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
      "SELECT mpt.membership_payment_id, mpt.membership_id, mpt.gateway_order_id, mpt.gateway_payment_id, " +
      "mpt.amount, mpt.currency, mpt.status, um.user_id, um.plan_id " +
      "FROM membership_payment_transactions mpt INNER JOIN user_memberships um ON um.membership_id = mpt.membership_id " +
      "WHERE mpt.membership_payment_id = ? AND mpt.gateway = 'RAZORPAY' LIMIT 1 FOR UPDATE",
      [purchaseId]
    );
    if (!rows.length) throw new Error('Membership payment was not found.');
    const payment = rows[0];

    if (payment.status === 'CAPTURED') {
      await connection.commit();
      return { purchaseId, status: 'CAPTURED', alreadyFinal: true };
    }
    if (payment.gateway_order_id !== gatewayOrderId) throw new Error('Payment order does not match this membership purchase.');
    if (payment.gateway_payment_id && String(payment.gateway_payment_id) !== String(gatewayPaymentId)) {
      throw new Error('A different payment is already linked to this membership purchase.');
    }
    if (Number(amount) !== cents(payment.amount) || String(currency).toUpperCase() !== 'INR') {
      throw new Error('Captured membership payment amount or currency does not match the selected plan.');
    }

    await connection.execute("SELECT user_id FROM users WHERE user_id = ? FOR UPDATE", [payment.user_id]);

    const [activeRows] = await connection.execute(
      "SELECT plan_id, expires_at FROM user_memberships " +
      "WHERE user_id = ? AND status = 'ACTIVE' AND starts_at <= NOW() AND expires_at > NOW() " +
      "ORDER BY expires_at DESC LIMIT 1 FOR UPDATE",
      [payment.user_id]
    );
    let startsAt = null;
    if (activeRows.length) {
      if (Number(activeRows[0].plan_id) !== Number(payment.plan_id)) {
        throw new Error('The active membership changed before payment capture. Contact VAGE support.');
      }
      startsAt = activeRows[0].expires_at;
    }

    const [planRows] = await connection.execute(
      "SELECT duration_days FROM membership_plans WHERE plan_id = ? AND is_active = 1 LIMIT 1",
      [payment.plan_id]
    );
    if (!planRows.length) throw new Error('The purchased membership plan is no longer active.');

    await connection.execute(
      "UPDATE user_memberships SET status = 'ACTIVE', starts_at = COALESCE(?, NOW()), " +
      "expires_at = DATE_ADD(COALESCE(?, NOW()), INTERVAL ? DAY), activated_at = NOW() " +
      "WHERE membership_id = ? AND status IN ('PENDING','FAILED')",
      [startsAt, startsAt, Number(planRows[0].duration_days || 365), payment.membership_id]
    );
    await connection.execute(
      "UPDATE membership_payment_transactions SET gateway_payment_id = ?, status = 'CAPTURED', " +
      "signature_verified = ?, paid_at = NOW() WHERE membership_payment_id = ?",
      [gatewayPaymentId, signatureVerified ? 1 : 0, purchaseId]
    );

    await connection.commit();
    return { purchaseId, membershipId: Number(payment.membership_id), status: 'CAPTURED', activated: true };
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
    throw new Error('Only a future queued renewal can be cancelled. Current memberships remain active until expiry; auto-renewal is not enabled.');
  }
  return { cancelled: true };
}

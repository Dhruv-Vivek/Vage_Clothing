import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_API_VERSION = '2025-01-01';

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('replace_with_') || value.includes('your_')) {
    throw new Error(`${name} is not configured. Add it to .env.local.`);
  }
  return value;
}

export function getCashfreeConfig() {
  const environment = String(process.env.CASHFREE_ENV || 'sandbox').trim().toLowerCase();
  if (!['sandbox', 'production'].includes(environment)) {
    throw new Error('CASHFREE_ENV must be sandbox or production.');
  }

  return {
    environment,
    baseUrl: environment === 'production'
      ? 'https://api.cashfree.com'
      : 'https://sandbox.cashfree.com',
    clientId: requiredEnv('CASHFREE_CLIENT_ID'),
    clientSecret: requiredEnv('CASHFREE_CLIENT_SECRET'),
    apiVersion: process.env.CASHFREE_API_VERSION?.trim() || DEFAULT_API_VERSION,
  };
}

function cashfreeHeaders(config, extra = {}) {
  return {
    'x-client-id': config.clientId,
    'x-client-secret': config.clientSecret,
    'x-api-version': config.apiVersion,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function cashfreeRequest(path, options = {}) {
  const config = getCashfreeConfig();
  const response = await fetch(`${config.baseUrl}/pg${path}`, {
    ...options,
    headers: cashfreeHeaders(config, options.headers || {}),
    cache: 'no-store',
    signal: options.signal || AbortSignal.timeout(15000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.message === 'string'
      ? payload.message
      : 'Cashfree request failed.';
    const error = new Error(message.slice(0, 300));
    error.status = response.status;
    error.code = typeof payload.code === 'string' ? payload.code : 'CASHFREE_API_ERROR';
    throw error;
  }

  return payload;
}

export async function createCashfreeOrder({
  orderId,
  amount,
  customer,
  returnUrl,
  notifyUrl,
  idempotencyKey,
}) {
  const config = getCashfreeConfig();
  const payload = {
    order_id: String(orderId),
    order_amount: Number(amount),
    order_currency: 'INR',
    customer_details: {
      customer_id: String(customer.id),
      customer_name: String(customer.name).slice(0, 120),
      customer_email: String(customer.email).slice(0, 190),
      customer_phone: String(customer.phone),
    },
    order_meta: {
      return_url: returnUrl,
      ...(notifyUrl ? { notify_url: notifyUrl } : {}),
    },
    order_note: 'VAGE Clothing order',
  };

  if (!Number.isFinite(payload.order_amount) || payload.order_amount < 1) {
    throw new Error('Cashfree requires an order amount of at least INR 1.');
  }

  const response = await cashfreeRequest('/orders', {
    method: 'POST',
    headers: {
      'x-idempotency-key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  if (
    typeof response.order_id !== 'string' ||
    typeof response.payment_session_id !== 'string' ||
    !response.payment_session_id
  ) {
    throw new Error('Cashfree returned an incomplete checkout session.');
  }

  return {
    orderId: response.order_id,
    paymentSessionId: response.payment_session_id,
    orderStatus: response.order_status,
    environment: config.environment,
  };
}

export function fetchCashfreeOrder(gatewayOrderId) {
  return cashfreeRequest(`/orders/${encodeURIComponent(gatewayOrderId)}`, {
    method: 'GET',
  });
}

export function fetchCashfreePayments(gatewayOrderId) {
  return cashfreeRequest(`/orders/${encodeURIComponent(gatewayOrderId)}/payments`, {
    method: 'GET',
  });
}

/**
 * Cashfree signs the exact raw request body prefixed by the webhook timestamp:
 * Base64(HMAC-SHA256(timestamp + rawBody, clientSecret)).
 */
export function verifyCashfreeWebhookSignature(rawBody, signature, timestamp) {
  if (
    typeof rawBody !== 'string' ||
    typeof signature !== 'string' ||
    typeof timestamp !== 'string' ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(signature) ||
    !signature ||
    !timestamp ||
    !/^\d{10,20}$/.test(timestamp)
  ) {
    return false;
  }

  const secret = requiredEnv('CASHFREE_CLIENT_SECRET');
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}${rawBody}`, 'utf8')
    .digest();

  let supplied;
  try {
    supplied = Buffer.from(signature, 'base64');
  } catch {
    return false;
  }

  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}

export function getCashfreeEnvironment() {
  return String(process.env.CASHFREE_ENV || 'sandbox').trim().toLowerCase();
}

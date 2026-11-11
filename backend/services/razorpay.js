import 'server-only';

/**
 * Backend-only Razorpay SDK configuration and signature helpers; credentials are read from server environment variables.
 * See backend/README.md for the database/backend walkthrough.
 */

import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'node:crypto';

let razorpayClient;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.startsWith('replace_with_') || value.includes('your_')) {
    throw new Error(`${name} is not configured. Add it to .env.local.`);
  }
  return value;
}

function getRazorpayKeyId() {
  const keyId = requiredEnv('RAZORPAY_KEY_ID');

  if (!/^rzp_(test|live)_/i.test(keyId)) {
    throw new Error('RAZORPAY_KEY_ID must be a valid Test Mode or Live Mode Razorpay Key ID.');
  }
  if (process.env.NODE_ENV !== 'production' && keyId.startsWith('rzp_live_')) {
    throw new Error('Live Razorpay credentials are blocked in local development. Use Test Mode keys beginning with rzp_test_.');
  }

  return keyId;
}

export function getRazorpay() {
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: getRazorpayKeyId(),
      key_secret: requiredEnv('RAZORPAY_KEY_SECRET'),
    });
  }
  return razorpayClient;
}

function safeHexEqual(expectedHex, suppliedHex) {
  if (
    typeof expectedHex !== 'string' ||
    typeof suppliedHex !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(expectedHex) ||
    !/^[a-f0-9]{64}$/i.test(suppliedHex)
  ) {
    return false;
  }

  const expected = Buffer.from(expectedHex, 'hex');
  const supplied = Buffer.from(suppliedHex, 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

/** Verify Checkout's order_id|payment_id signature using the API key secret. */
export function verifyCheckoutSignature(orderId, paymentId, signature) {
  const secret = requiredEnv('RAZORPAY_KEY_SECRET');
  const expected = createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return safeHexEqual(expected, signature);
}

/** Verify webhook signature against the exact, unparsed request body. */
export function verifyWebhookSignature(rawBody, signature) {
  const secret = requiredEnv('RAZORPAY_WEBHOOK_SECRET');
  const expected = createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return safeHexEqual(expected, signature);
}

export function getRazorpayPublicKey() {
  return getRazorpayKeyId();
}

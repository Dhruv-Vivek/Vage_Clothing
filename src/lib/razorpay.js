import 'server-only';

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

export function getRazorpay() {
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: requiredEnv('RAZORPAY_KEY_ID'),
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
  return requiredEnv('RAZORPAY_KEY_ID');
}

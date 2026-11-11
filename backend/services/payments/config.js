import 'server-only';

/**
 * Backend-only payment-provider configuration; secrets remain server-side.
 * See backend/README.md for the database/backend walkthrough.
 */

const SUPPORTED_PROVIDERS = new Set(['DEMO', 'CASHFREE', 'RAZORPAY']);

export function getConfiguredPaymentProvider() {
  const configured = String(
    process.env.PAYMENT_PROVIDER ||
    (process.env.RAZORPAY_KEY_ID ? 'RAZORPAY' : 'DEMO')
  ).trim().toUpperCase();

  if (!SUPPORTED_PROVIDERS.has(configured)) {
    throw new Error('PAYMENT_PROVIDER must be DEMO, CASHFREE, or RAZORPAY.');
  }

  if (configured === 'DEMO' && !isDemoPaymentsEnabled()) {
    throw new Error(
      'DEMO payments are disabled. Set ALLOW_DEMO_PAYMENTS=true in local development only.'
    );
  }

  if (process.env.NODE_ENV === 'production' && configured === 'DEMO') {
    throw new Error('DEMO payments are never allowed in production.');
  }

  return configured;
}

export function isDemoPaymentsEnabled() {
  return (
    process.env.NODE_ENV !== 'production' &&
    String(process.env.PAYMENT_PROVIDER || '').trim().toUpperCase() === 'DEMO' &&
    process.env.ALLOW_DEMO_PAYMENTS === 'true'
  );
}

# VAGE Clothing — Batch 6.1: Cashfree + Local Demo Payments

This change adds Cashfree Hosted Checkout support and an explicitly development-only demo payment simulator. Both payment paths use the same MySQL order finalisation, inventory, coupon compensation and Resend email-outbox services.

## Branch

`feature/batch-6.1-cashfree-demo`

This branch is based on `feature/batch-6-payments-email`. It does not merge or replace the existing Batch 6 draft PR.

## 1. Database migration

Run these migrations in order if they have not already been applied:

1. Batch 5–6 migration (membership, order gateway, webhook inbox, email outbox and order metadata).
2. `database/vage-batch6-payments-migration.sql` (RAZORPAY payment method and checkout idempotency table).
3. `database/vage-batch6.1-cashfree-demo-migration.sql` (CASHFREE/DEMO payment methods, gateway session fields, generic idempotency fields and Cashfree webhook inbox).
4. `database/vage-batch6.1.1-demo-otp-migration.sql` (session storage for the separate local VAGE demo gateway and OTP screen).

The Batch 6.1 migration is additive and re-runnable. It does not drop data or remove Razorpay columns.

## 2. Local DEMO mode

For a local college/demo environment, set these in `.env.local`:

```env
PAYMENT_PROVIDER=DEMO
ALLOW_DEMO_PAYMENTS=true
```

Keep your existing DB, JWT and Resend settings. Do not commit `.env.local`.

DEMO is only enabled when all these conditions hold:
- `NODE_ENV` is not production.
- `PAYMENT_PROVIDER=DEMO`.
- `ALLOW_DEMO_PAYMENTS=true`.

The demo API is unavailable in production. It does not contact Cashfree or Razorpay and does not create a real-world payment. The UI labels the simulated outcome clearly.

For each checkout, the demo screen offers SUCCESS, FAILED, PENDING and USER DROPPED. Success invokes the same provider-neutral order capture and email-outbox logic. Failed/user-dropped outcomes cancel the unpaid order and release its reserved stock/coupon usage once. Pending leaves the order pending.

## 3. Cashfree sandbox mode

Set:

```env
PAYMENT_PROVIDER=CASHFREE
CASHFREE_ENV=sandbox
CASHFREE_API_VERSION=2025-01-01
CASHFREE_CLIENT_ID=your_cashfree_sandbox_app_id
CASHFREE_CLIENT_SECRET=your_cashfree_sandbox_secret
APP_BASE_URL=http://localhost:3000
```

Cashfree requires merchant App ID/Secret and an allowed website domain for a real application integration. DevStudio's sample playground credentials are not copied into VAGE and are not treated as permanent merchant credentials.

For local webhook delivery, use a public HTTPS tunnel and set its URL as APP_BASE_URL. The Cashfree webhook URL is `/api/webhooks/cashfree`. Subscribe to the relevant payment success/failure/user-dropped events in the Cashfree dashboard when the merchant sandbox is available.

## 4. Cashfree flow

1. VAGE creates the pending order, reserves inventory and creates the payment row in MySQL.
2. VAGE creates a Cashfree order server-side and stores the gateway order ID and payment session ID.
3. The browser opens Cashfree Hosted Checkout with the payment session ID.
4. Cashfree returns the customer to VAGE's order-success page.
5. VAGE queries Cashfree server-side and confirms the order/payment status before marking the order paid.
6. Signed Cashfree webhooks are deduplicated and reconciled with Cashfree's API before finalisation.
7. Successful payment reuses the existing order email outbox.

## 5. Existing Razorpay support

Razorpay code remains in place as a legacy provider. Select a provider using PAYMENT_PROVIDER. Cashfree mode does not initialize Razorpay credentials; DEMO mode does not initialize either gateway client.

## 6. Important

- The DEMO flow is a simulator, not a payment gateway.
- Do not use it in production.
- Cashfree checkout cannot be started from DevStudio's temporary payment_session_id in VAGE; VAGE needs its own Cashfree-created order.
- No build, lint, migration or payment-flow test is claimed by this implementation change.

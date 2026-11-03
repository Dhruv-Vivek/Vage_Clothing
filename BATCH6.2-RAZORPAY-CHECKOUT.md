# VAGE Batch 6.2 — Razorpay Checkout Completion

## Branch

`feature/batch-6.2-razorpay-checkout`

This batch completes the existing server-created Razorpay Orders API + Standard Checkout flow. It keeps Razorpay, Cashfree and the local demo provider available; the active provider is selected using `PAYMENT_PROVIDER`.

## Changes in this batch

- Checkout now supports the promo-code field already accepted by the server checkout API. Coupon eligibility, membership discounts, stock and payable total remain authoritative in MySQL.
- Checkout CTA no longer presents the browser estimate as the charge amount. Razorpay receives the server-calculated paise amount.
- Captured-payment handling queues order confirmation and payment receipt messages, then returns without waiting for Gmail SMTP. The existing email outbox worker performs delivery.
- The order-success page refreshes the outbox status while queued emails are being processed and displays the order-specific checkout email.
- Added the missing Razorpay webhook inbox migration. The receiver verifies the raw-body signature, durably stores each event and returns quickly; a worker fetches the current Razorpay payment state and performs idempotent order reconciliation.

## Apply the webhook migration

Open and execute:

`database/vage-batch6.2-razorpay-webhook-migration.sql`

It is additive and re-runnable. It creates `razorpay_webhook_events`, which is referenced by `src/app/api/webhooks/razorpay/route.js`.

## Configure Razorpay Test Mode locally

Use **Test Mode** API credentials first. Do not use live credentials for development or test transactions. The local server rejects a Key ID beginning with `rzp_live_`.

Add or update these entries in the existing `.env.local` file. Do not overwrite the DB, JWT, Gmail or CRON values already there:

```env
PAYMENT_PROVIDER=RAZORPAY
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_test_mode_key_secret
RAZORPAY_WEBHOOK_SECRET=your_test_mode_webhook_secret
```

The Key Secret and Webhook Secret are different secrets. Keep both server-side and never paste them into chat, frontend code, screenshots, Git commits or `.env.example`.

The active email provider is Gmail SMTP; no Resend API key is needed for the current mailer.

## Razorpay Dashboard setup

1. Switch the Razorpay Dashboard to Test Mode.
2. Generate/copy the Test Mode Key ID and Key Secret.
3. In payment capture settings, enable automatic capture for Orders API payments. VAGE only marks an order paid when the server confirms the payment is captured; authorised-only payments remain pending.
4. Configure a Test Mode webhook URL to an HTTPS tunnel pointing to:
   `/api/webhooks/razorpay`
5. Use a separate webhook secret and copy that exact value into `RAZORPAY_WEBHOOK_SECRET`.
6. Subscribe to:
   - `payment.captured`
   - `payment.authorized`
   - `payment.failed`

The local server must be reachable from Razorpay over HTTPS for dashboard webhook delivery. The webhook route verifies and stores the event, then acknowledges it; the scheduled worker performs payment fetching and reconciliation. The checkout callback can be tested locally without a public webhook, but webhook delivery itself needs a reachable HTTPS URL.

## Run locally

```powershell
npm ci
npm run build
npm run dev
```

Ensure the laptop has outbound access to Gmail SMTP port 587 (the current Gmail mailer uses STARTTLS on port 587).

## End-to-end Test Mode checklist

1. Sign in as a test customer and add an in-stock size/colour variant.
2. Enter the checkout email address and shipping details.
3. Optionally enter a coupon code. The API validates it and recalculates the payable amount server-side.
4. Continue to Razorpay Checkout and use Razorpay's current Test Mode instruments. Do not enter a real card or use real money.
5. Complete a successful test payment.
6. Check the Razorpay Dashboard Test Mode payment is captured.
7. Verify the VAGE order is `CONFIRMED / PAID`, the payment row is `SUCCESS`, the gateway row is `CAPTURED`, and inventory is reserved exactly once.
8. Confirm two `email_outbox` rows exist: `ORDER_CONFIRMATION` and `PAYMENT_RECEIPT`, initially `PENDING`.
9. Run the local email worker using the CRON_SECRET (example below). Both events should become `SENT` when Gmail accepts the messages.
10. Run the scheduled worker and verify the `razorpay_webhook_events` row moves through `RECEIVED` / `PROCESSING` to `PROCESSED` after a Test Mode webhook is delivered.
11. Test failed payment, modal dismissal and duplicate webhook delivery. Failed/dismissed unpaid orders should release reserved stock once; a captured order must never be cancelled by a late failure event.

## Verify database state

```sql
USE vage_clothing;

SELECT o.order_number, o.status, o.payment_status, o.total_amount,
       p.status AS payment_row_status, p.transaction_ref,
       g.gateway, g.status AS gateway_status, g.gateway_payment_id
FROM orders o
JOIN payments p ON p.order_id = o.order_id
JOIN order_payment_gateways g ON g.payment_id = p.payment_id
ORDER BY o.order_id DESC
LIMIT 10;

SELECT event_type, recipient_email, status, attempts, last_error, sent_at
FROM email_outbox
ORDER BY email_outbox_id DESC
LIMIT 10;

SELECT provider_event_id, event_type, processing_status, attempts, last_error, received_at, processed_at
FROM razorpay_webhook_events
ORDER BY razorpay_webhook_event_id DESC
LIMIT 10;
```

## Trigger the email worker during local development

After a successful order, the payment API only queues email rows. The same scheduled worker also processes received Razorpay webhook events. To process them locally, open a separate PowerShell window and set the same CRON_SECRET that is in `.env.local` (PowerShell does not automatically import `.env.local`):

```powershell
$env:CRON_SECRET = "paste-the-local-CRON_SECRET-value-here"
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/cron/dispatch-email-outbox" -Headers $headers
Remove-Item Env:CRON_SECRET
```

In production, schedule this protected endpoint at a short regular interval. A successful payment response does not wait for Gmail delivery.

## Razorpay implementation guarantees

- Amount comes from the server-created VAGE order in paise.
- Callback signature is verified server-side using the API Key Secret.
- Payment is fetched from Razorpay and must match the VAGE order, amount and INR currency.
- Only captured payments become `PAID`.
- Webhook signature is checked against the exact raw request body using the distinct Webhook Secret.
- Webhook event IDs are stored uniquely to deduplicate retries.
- Payment capture and email outbox rows are committed transactionally.
- Customer emails are delivered by the worker, not during the payment callback.

## Live launch is a separate gate

Do not change to Live Mode until the Test Mode success, failure, dismissal, duplicate-webhook, email and stock-restoration checks pass. Live mode uses a different Key ID, Key Secret and webhook configuration. Razorpay account activation and the payment methods enabled for the merchant account must also be confirmed.

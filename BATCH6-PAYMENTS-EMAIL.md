# VAGE Clothing — Batch 6: Razorpay Checkout & Transactional Email

This branch adds real product-order checkout and payment handling to the existing Next.js 15 + MySQL application. It deliberately does **not** activate memberships; the Batch 5 membership-purchase flow remains a separate implementation task. If a valid active row already exists in `user_memberships`, checkout applies its discount and shipping rule from MySQL.

## Included

- Variant-aware cart lines. The exact `variant_id`, size, colour, SKU and price are kept per cart line. Product cards route to product detail so the customer selects a variant before adding it.
- Authenticated order creation using current MySQL prices and inventory, transactionally reserved stock, coupon limits and idempotency keys.
- Razorpay Orders API integration in test mode, signed checkout verification and raw-body webhook verification.
- Payment capture finalisation: payment becomes `SUCCESS`, order becomes `CONFIRMED / PAID`, and two email-outbox records are created.
- Payment failure / dismissed checkout reconciliation and a protected 24-hour stale-checkout reconciler.
- Resend order-confirmation and payment-receipt emails with a durable MySQL outbox and provider idempotency key.
- Authenticated order-status API and order-success page backed by MySQL.

## 1. Install / update

From the project root:

```powershell
git fetch origin
git switch feature/batch-6-payments-email
git pull origin feature/batch-6-payments-email
npm install
```

The merged main branch already contains `razorpay` and `resend` dependencies. `npm install` synchronises the lockfile.

## 2. Apply the Batch 6 SQL migration

The earlier Batch 5–6 migration must already have been run. Now open:

`database/vage-batch6-payments-migration.sql`

Execute it against `vage_clothing` in MySQL Workbench. It is additive and:
- extends `payments.payment_method` with `RAZORPAY`;
- creates `checkout_idempotency_keys`.

The final two statements show the enum and new table. No existing orders, users, or inventory rows are dropped.

## 3. Configure local secrets

Keep the existing `DB_*` and a freshly rotated `JWT_SECRET` in `.env.local`. Add these values locally (do not paste them in chat or commit them):

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RESEND_API_KEY=re_...
EMAIL_FROM=Vage Clothing <orders@your-verified-domain.com>
EMAIL_REPLY_TO=support@your-verified-domain.com
CRON_SECRET=<random secret of at least 32 characters>
```

Generate a new CRON secret:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use Razorpay **Test Mode** keys only while developing. Do not use Live Mode keys until the complete end-to-end test has passed.

## 4. Razorpay Dashboard settings

1. Use a Razorpay account with Orders API enabled and copy the Test Mode Key ID and Key Secret.
2. Enable **automatic capture** in Razorpay Dashboard for Orders API payments. VAGE only marks an order paid after a captured payment is confirmed from Razorpay. Authorised-only payments remain pending.
3. Add a webhook pointing to:
   `https://<your-public-development-or-production-host>/api/webhooks/razorpay`
4. Set a webhook secret, put the same value in `RAZORPAY_WEBHOOK_SECRET`, and subscribe to:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
5. For local testing, expose your local Next.js server through a secure HTTPS development tunnel and use that HTTPS URL in the Razorpay webhook dashboard.

The webhook validates the HMAC signature using the exact raw request body and deduplicates events by Razorpay event ID.

## 5. Resend setup

1. Create a Resend API key and put it in `RESEND_API_KEY`.
2. Verify the sender domain in Resend, including its required DNS records.
3. Use an address on that verified domain in `EMAIL_FROM`. Set `EMAIL_REPLY_TO` to a monitored support mailbox.
4. The application queues two events only after payment capture: `ORDER_CONFIRMATION` and `PAYMENT_RECEIPT`.

Email delivery is independent from payment finalisation. A temporary Resend failure leaves the order paid and the email in the retryable outbox; it must never undo a captured payment.

## 6. Scheduled workers

Two protected POST endpoints are provided. Both require:

`Authorization: Bearer <CRON_SECRET>`

- `/api/cron/dispatch-email-outbox` — sends up to 20 pending/failed email events and recovers stale PROCESSING rows.
- `/api/cron/reconcile-pending-orders` — checks up to 10 checkouts older than 24 hours against Razorpay before cancelling and releasing stock. Authorised payments are left pending.

Run both endpoints on a schedule (for example, once per minute for the email worker and every 10–15 minutes for reconciliation) using your deployment platform's scheduler. During local testing, you can call them manually with PowerShell after setting the same CRON_SECRET in the current terminal session:

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/cron/dispatch-email-outbox" -Headers $headers
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/cron/reconcile-pending-orders" -Headers $headers
```

## 7. Run and test

```powershell
npm run build
npm run lint
npm run dev
```

End-to-end Test Mode test:

1. Sign in as a test customer.
2. Open a product detail page, select a size/colour variant, choose quantity and add it to cart.
3. Confirm the cart shows the selected variant and quantity. Remove old localStorage cart lines that have no variant selection.
4. Complete the shipping and delivery steps and open Razorpay Checkout.
5. Use Razorpay's currently documented Test Mode payment instruments. Do not use a real card or real UPI account.
6. After Razorpay capture, verify that `orders.status = 'CONFIRMED'`, `orders.payment_status = 'PAID'`, the payment row is `SUCCESS`, the gateway row is `CAPTURED`, inventory was reduced, and two outbox entries were created.
7. Check Resend logs and the customer's mailbox. The order-success page displays payment and email-outbox statuses.
8. Test a failed attempt and close Checkout: the order should be cancelled and reserved stock restored. A failed attempt while Checkout remains open does not immediately cancel the order, allowing a customer retry in the same gateway window.
9. Test duplicate webhook deliveries; the event inbox and email dedupe keys should prevent repeated finalisation and duplicate sends.

## API routes added

- `POST /api/checkout/create-order`
- `POST /api/payments/verify`
- `POST /api/payments/abandon`
- `POST /api/webhooks/razorpay`
- `GET /api/orders/:id`
- `POST /api/orders/:id/emails`
- `POST /api/cron/dispatch-email-outbox`
- `POST /api/cron/reconcile-pending-orders`

## Important scope and deployment notes

- Prices and stock are always fetched and checked on the server; browser totals are estimates only.
- The cart remains guest/localStorage based in this batch, but every line is variant-specific. Server-side logged-in cart persistence and merging remains a separate batch.
- Membership purchases and activation are not implemented here. Checkout only reads already-active membership rows to apply benefits.
- The city/district field is validated as required text; the state/UT is a dropdown. This batch does not implement a state-dependent district lookup catalogue.
- Email delivery requires an active Resend account, verified sender domain and scheduled outbox worker. Do not show a successful email state until the outbox reports `SENT`.
- Do not deploy to production before running the tests, rotating the exposed MySQL/JWT credentials previously found in the committed `.env.example`, and reviewing your repository history/secret exposure. Replacing `.env.example` does not rotate credentials or remove old values from Git history.

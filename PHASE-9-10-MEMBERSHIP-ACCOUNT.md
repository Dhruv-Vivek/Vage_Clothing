# VAGE — Phase 9 and Phase 10: Membership + Customer Account

This branch adds database-backed membership purchases and customer account features to the existing Next.js + MySQL VAGE application.

## Scope

### Phase 9 — Membership

- Membership plans and pricing are read from MySQL (membership_plans).
- Membership purchase creates a pending user_memberships row and a related membership_payment_transactions row.
- Razorpay Orders are created server-side. The browser cannot set the membership price.
- The membership is activated only after Razorpay confirms a captured payment and VAGE verifies the order reference, amount and INR currency.
- The Razorpay webhook worker can process membership captures as well as product-order captures.
- An authorised payment remains pending; it does not activate benefits.
- A dismissed checkout is reconciled against Razorpay before the payment is marked failed.
- Renewal of the same plan is available during the final 30 days. A paid renewal is queued to start when the current term expires.
- Membership does not auto-renew. This implementation does not provide membership cancellation/refunds for a paid future term.

### Phase 10 — Customer account

- Profile read/update (full_name, email, phone).
- Saved address book with add, edit, delete and default-address management.
- Wishlist persistence in MySQL for signed-in users. Guest favorites are merged into the account on sign-in.
- Paginated customer order history.
- Customer order details, delivery progress and database status history.
- Checkout can prefill shipping fields from a saved address.

Saved delivery addresses use saved_addresses. Product orders continue to write a separate row to the existing addresses table as an order-specific address snapshot. Editing or deleting a saved address therefore does not change the shipping address recorded on an earlier order.

## Database migration

Back up the vage_clothing database before changing the schema.

Run this file in MySQL Workbench against vage_clothing:

database/vage-phase9-10-membership-account-migration.sql

The script is additive and uses CREATE TABLE IF NOT EXISTS and conditional column/index changes. It preserves existing membership plan prices and benefits, filling the new display/purchase fields only when they are NULL. It creates or extends:

- membership_plans
- user_memberships
- membership_payment_transactions
- saved_addresses
- wishlist_items

The migration seeds Basic, Premium and VIP plans only when those plan codes do not already exist. Existing values are not overwritten.

After running it, verify:

    USE vage_clothing;

    SHOW TABLES LIKE 'membership_plans';
    SHOW TABLES LIKE 'user_memberships';
    SHOW TABLES LIKE 'membership_payment_transactions';
    SHOW TABLES LIKE 'saved_addresses';
    SHOW TABLES LIKE 'wishlist_items';

    SELECT plan_code, plan_name, annual_price, display_name, price_amount,
           duration_days, discount_percent, free_shipping_minimum,
           free_shipping_methods, is_active
    FROM membership_plans
    ORDER BY plan_id;

## Environment

No new provider secret is introduced. Keep the existing server-side values in .env.local:

- DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
- JWT_SECRET
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- RAZORPAY_WEBHOOK_SECRET
- CRON_SECRET

Use Razorpay Test Mode credentials for development. Never commit .env.local or paste secret values into an issue or chat.

## Routes added

### Membership

| Method | Route | Purpose |
|---|---|---|
| GET | /api/membership | Plans, active membership, queued renewal, history and payment attempts |
| POST | /api/membership/purchases | Create server-priced membership purchase and Razorpay order |
| POST | /api/membership/verify | Verify Checkout signature and fetch authoritative payment state |
| POST | /api/membership/abandon | Reconcile a dismissed membership checkout |

### Customer account

| Method | Route | Purpose |
|---|---|---|
| GET / PATCH | /api/account/profile | Read/update the signed-in customer's profile |
| GET / POST | /api/account/addresses | List/create saved addresses |
| PATCH / DELETE | /api/account/addresses/:id | Update/delete an address owned by the signed-in user |
| GET / POST / DELETE | /api/account/wishlist | Read/add/remove wishlist products |
| GET | /api/account/orders | Paginated order history |
| GET | /api/orders/:id | Existing owner-scoped order details, now including status history |

### Customer pages

- /account — profile and account shortcuts
- /account/addresses — saved address book
- /account/orders — paginated order history
- /account/orders/:id — order details and delivery progress
- /favorites — persistent wishlist for signed-in customers; local guest wishlist before sign-in
- /membership — database-backed plans, Razorpay purchase, membership status and history

## Payment lifecycle

1. The signed-in customer chooses a plan.
2. VAGE loads the plan price from MySQL and creates a PENDING membership row plus payment transaction.
3. VAGE creates a Razorpay Order using the server-side price.
4. Checkout returns the Razorpay order/payment/signature references.
5. VAGE validates the Checkout signature, fetches the payment from Razorpay and checks the order, amount and currency.
6. Only a captured payment changes the membership row to ACTIVE and sets starts_at / expires_at.
7. A signed Razorpay webhook is stored in razorpay_webhook_events. The scheduled webhook worker can finalise membership purchases even if the browser callback did not complete.
8. A dismissed checkout calls the reconciliation API. If no captured or authorised payment exists, the pending membership/payment is marked failed; no benefits are activated.

The webhook dashboard must include payment.authorized, payment.captured and payment.failed. The existing protected /api/cron/dispatch-email-outbox worker processes queued Razorpay events. It requires Authorization: Bearer CRON_SECRET.

## Manual verification checklist

### Membership

1. Apply the migration and confirm the three plans appear on /membership.
2. Sign in as a test customer and start a Basic membership using Razorpay Test Mode.
3. Before capture, verify the matching user_memberships.status is PENDING and membership_payment_transactions.status is CREATED or AUTHORIZED.
4. Complete a successful captured Test Mode payment.
5. Verify the membership becomes ACTIVE, starts_at is populated and expires_at is duration_days after the start.
6. Verify membership_payment_transactions.status = CAPTURED, its gateway_payment_id is set and signature_verified = 1 for Checkout verification.
7. Close a failed/abandoned attempt and confirm it becomes FAILED without activating benefits.
8. Send/allow webhook delivery and call the protected email/webhook worker. Confirm the membership is still activated only once.
9. Test a second click/double-submit and ensure only one unresolved membership payment exists.
10. Test renewal eligibility during the final 30 days; the next term must start at the existing expiry, not immediately.

### Customer account

1. Register/sign in and update profile name, email and phone.
2. Add two saved addresses; set one as default; edit it; delete the other.
3. Confirm exactly one saved address is default when at least one address exists.
4. Place a test order using a saved address. Confirm checkout created a separate row in addresses.
5. Edit/delete the saved address and verify the historical order address remains unchanged.
6. Add/remove wishlist products while signed in. Refresh and verify the wishlist remains.
7. Add guest favorites, sign in, and verify they merge into the account wishlist.
8. Log out and sign in as a different account; verify the previous customer's wishlist is not carried over.
9. Verify /account/orders shows only the authenticated user's orders, and an order ID owned by another customer returns 404 from /api/orders/:id.
10. Verify order detail includes order_status_history entries.

## Important implementation notes

- This change does not add MongoDB; the new membership and account features use the existing MySQL database.
- Product-order payment logic and Gmail transactional email delivery remain on the existing Batch 6.2 path.
- Membership payments use membership_payment_transactions; they do not create product orders or product payment rows.
- Membership benefits are still applied by the existing product checkout pricing query against ACTIVE, date-valid user_memberships rows.
- Saved addresses are separate from order address snapshots.
- No live payment, production deployment or local build is claimed by this source change. Run the verification checklist on a local environment with the migration applied before merging or enabling production payments.

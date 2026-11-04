# VAGE — Batch 7 admin operations integration

This integration adapts the Batch 7 admin dashboard and contact inbox to the current VAGE application. It intentionally reuses the existing admin route/layout and the order, payment, return, refund and email lifecycle services.

## Included

- Existing `/admin` overview and low-stock report, extended with paid revenue, order totals, fulfilment counts, active customers, low-stock variants, contact email follow-up counts, revenue trend, order-status distribution and recent orders.
- `/admin/orders` retains the existing order/returns-aware admin order tooling and its current database-backed API.
- `/admin/returns` retains the Phase 9–10 customer return review flow: approve/reject, mark received, and attempt an eligible Razorpay refund.
- `/admin/messages` provides a searchable and paginated Contact Us inbox, delivery status for the VAGE notification and customer acknowledgement, and a reply-by-email link.
- Admin sidebar links retain Product Intelligence and add Returns, Messages and the Batch 7 operations surfaces.
- Admin pages and APIs reuse `requireAdminPage` and `adminRoute`. The Batch 7 branch's legacy `admin-auth.js` helper was not introduced.

## Admin access

Public sign-up continues to create CUSTOMER accounts. To promote an existing account that you control:

1. Create or use the ordinary VAGE storefront account.
2. Open `database/vage-batch7-admin-bootstrap.sql`.
3. Replace both example email occurrences with that account's email.
4. Execute the SQL in MySQL Workbench against `vage_clothing`.
5. Verify the selected account has `role = 'ADMIN'` and `is_active = 1`.
6. Sign out and sign back in to refresh the session.

The script changes only the role of an existing active account. It does not create users, change passwords or expose role selection in public registration. Do not run it with a guessed or unowned email address.

## PR #11 COD checkout database fields

Before testing the COD checkout against MySQL, inspect and apply the additive migration `database/vage-pr11-cod-checkout-compat-migration.sql`. It ensures the order columns used by the current checkout, online checkout and lifecycle email queries exist: `contact_email`, `coupon_discount_amount`, `membership_discount_amount` and `delivery_method`. It is safe to re-run. The COD route itself creates the order with a locked transaction and does not call the missing `place_order` stored procedure.

## Contact inbox database requirement

The inbox reads `contact_messages`, created by the existing `database/vage-gmail-contact-migration.sql` migration already in the main codebase. That table stores the submitted message and separate delivery statuses for the notification to VAGE and acknowledgement to the customer.

Do not run the full `schema_dump.sql` against an existing database; it contains destructive DROP TABLE statements. Do not execute migrations again blindly if they have already been applied. Inspect the table first with:

```sql
USE vage_clothing;
SHOW TABLES LIKE 'contact_messages';
SHOW COLUMNS FROM contact_messages;
```

The contact inbox is read-only in this slice. Staff reply through their email client using the message's mailto link.

## Order lifecycle compatibility

PR #11's COD checkout is retained. The order lifecycle has been aligned so that:

- COD orders can move from PENDING to CONFIRMED and through PROCESSING, SHIPPED and DELIVERED before payment is collected.
- Online orders still need a captured payment before fulfilment.
- Manual payment recording is restricted to delivered COD orders.
- Customer/admin cancellation uses the existing lifecycle service, not the PR's direct inventory mutation helper.
- Captured Razorpay payments follow the existing idempotent refund path. A provider without a supported automatic refund is not reported as refunded.
- Cancellation retains the existing stock, coupon, audit-history and email-event behavior.

## Main routes

- `/admin` — existing overview + Batch 7 performance dashboard
- `/admin/orders` — order browser and detail actions
- `/admin/returns` — return requests and eligible refund workflow
- `/admin/messages` — Contact Us inbox
- `/admin/product-intelligence` — MongoDB behavioural analytics

Admin API routes use the current signed-session, active-account and ADMIN-role checks. Hiding links in the browser is not used as an authorization mechanism.

## Local verification

After pulling the integration branch, inspect and run the additive checkout migration above if those columns are not already present, then install dependencies and run:

```powershell
npm ci
npm run lint
npm run build
npm run dev
```

Then verify using an active ADMIN account:
- Overview loads both the original low-stock section and the new performance metrics.
- Orders are searchable and the order detail route supports allowed state changes.
- A COD order can be confirmed, fulfilled and marked paid only after delivery.
- Return actions respect the return status transitions and provider refund eligibility.
- The inbox lists submitted contact messages and displays both email delivery statuses.
- Product Intelligence still opens and reads MongoDB data when configured.

Also test with a normal CUSTOMER account: `/admin` should redirect to the storefront and admin APIs should return 403. No order, refund, stock or real email action should be tested against live data without using a deliberate test account.
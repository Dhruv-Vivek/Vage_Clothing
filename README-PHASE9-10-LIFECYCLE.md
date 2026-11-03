# VAGE Phase 9/10 — Checkout pricing, membership and customer order lifecycle

This branch extends the existing Next.js/MySQL checkout. It retains the existing Razorpay + Cashfree + local demo provider selection and Gmail SMTP transactional outbox.

## Database migration order

1. Apply the existing Batch 6 / 6.1 / 6.2 migrations as documented in the repository.
2. Apply `database/vage-phase9-10-membership-account-migration.sql` (membership plans/purchases, saved addresses, wishlist).
3. Apply `database/vage-phase9-10-lifecycle-notifications-migration.sql` (new outbox event names and return refund reference fields).

Both Phase 9/10 migrations are additive and re-runnable. Do not run a schema dump over an existing database; it contains destructive DROP statements.

## Shared checkout pricing

`src/lib/checkout-pricing.js` is used by both:
- `POST /api/checkout/quote`: read-only estimate; invalid coupons are reported but do not block the estimate.
- `POST /api/checkout/create-order`: recalculates under row locks and rejects invalid coupons.

The browser never supplies product prices, coupon discounts, membership benefits or shipping prices. The order-creation transaction is authoritative; quote results are preview-only and stock/prices may change before final order creation.

## Membership

Membership purchase amounts and benefits come from `membership_plans`. Razorpay payment verification and the durable webhook worker activate membership only after a captured payment matches the stored gateway order, INR amount and signature. Renewal purchases are queued to start after the active period. The membership activation email is queued in the same MySQL transaction as activation.

Membership expiry notices are queued by the protected `/api/cron/dispatch-email-outbox` worker using deterministic dedupe keys. Configure the worker to run periodically (for example every 15 minutes) with the existing `CRON_SECRET`.

Membership is a one-time paid term with a renewal flow; this does not create an automatic recurring card mandate.

## Customer order lifecycle

- Customers can cancel their own orders before shipment. Unpaid orders release reserved stock; captured Razorpay orders use an idempotent refund key and restore stock/coupon usage once.
- Customer returns can be requested only for delivered orders, within `RETURN_WINDOW_DAYS` (defaults to 7 days), with quantity capped against the remaining units.
- Admin fulfilment supports CONFIRMED → PROCESSING → SHIPPED → DELIVERED. The database trigger remains the state-transition guard.
- Admin returns support REQUESTED → APPROVED/REJECTED → RECEIVED → REFUNDED. Returned stock is restocked when marked received. Refunds are currently automated only for Razorpay-captured payments.
- Cashfree refunds are intentionally not simulated; those cases return a conflict and should be handled through the merchant's Cashfree refund workflow/support until a verified Cashfree refund API integration is added.
- Partial returns are recorded individually. The existing order payment enum has no PARTIALLY_REFUNDED state, so `orders.payment_status` changes to REFUNDED only when every purchased unit has been refunded.

## Gmail outbox

Lifecycle and membership notifications are stored in the existing `email_outbox`. Gmail SMTP is still the active sender; no Resend configuration is required. The existing dispatcher handles order confirmation/receipt plus new shipment, delivery, cancellation, return and membership events.

## Manual test checklist

1. Run both Phase 9/10 SQL migrations in MySQL Workbench.
2. Run `npm ci`, `npm run lint`, and `npm run build`.
3. Use Razorpay Test Mode to purchase a membership; verify capture, membership activation, and membership activation outbox row.
4. Use an active membership and a coupon to compare `/api/checkout/quote` with the server-created order amount; test expired/invalid coupons and stock changes.
5. Save multiple addresses, set a default, edit/delete one, and confirm historical order snapshots remain unchanged.
6. Add/remove wishlist products while signed in and verify the list survives refresh.
7. Cancel an unpaid order and a Razorpay Test Mode paid order; confirm stock and coupon usage are restored once and duplicate cancel requests do not refund twice.
8. Advance a paid test order through processing, shipped and delivered; verify email outbox rows.
9. Request partial/full returns, reject a request with a note, approve and mark received, then test Razorpay refund and final RETURNED status.
10. Confirm Cashfree cancellation/return refund is rejected clearly rather than reported as refunded.
11. Verify customers cannot access another customer's order/address/wishlist and non-admin users cannot access admin APIs.
12. Run the protected email worker and confirm queued notifications reach SENT or expose a retryable FAILED status.

No live payment or live Gmail delivery is implied by code publication. Keep all gateway and Gmail secrets in local environment variables only.

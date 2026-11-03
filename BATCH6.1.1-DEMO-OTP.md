# VAGE Batch 6.1.1 — Dedicated Demo Gateway + OTP

This add-on implements a separate VAGE payment page for the local DEMO provider. It does not contact Cashfree/Razorpay and does not collect real credentials.

## Migration

Run `database/vage-batch6.1.1-demo-otp-migration.sql` after the Batch 5–6, Batch 6 and Batch 6.1 migrations.

## Local environment

Keep these values in `.env.local`:

```env
PAYMENT_PROVIDER=DEMO
ALLOW_DEMO_PAYMENTS=true
```

Do not use DEMO in production. The server rejects demo OTP routes when production is enabled.

## Demo flow

1. Complete VAGE shipping and delivery.
2. VAGE sends the order to the new `/demo-payment?orderId=...` screen.
3. Choose UPI, Card, Net Banking or Wallet.
4. Request a demo OTP; the page displays the fixed code `111000` (it is not sent by SMS or email).
5. Enter the OTP and choose an outcome (success, failed, pending or user dropped).
6. The server checks the signed-in user, order ownership, session token, salted OTP hash, five-minute expiry and five-attempt limit before consuming the OTP session.
7. Success uses the shared MySQL order finalisation without queueing or sending email notifications. Automated order emails are intentionally deferred to a later phase.
8. The order-success page explicitly labels the transaction as a demo and does not show email delivery failures for this flow.

This is a visibly labelled simulation. The fixed OTP is not a real phone/email OTP and proves no ownership of an external mailbox or phone number.

## No test/build/migration execution claimed

This source change has not been built or tested. Execute the SQL migration manually and then run local verification.

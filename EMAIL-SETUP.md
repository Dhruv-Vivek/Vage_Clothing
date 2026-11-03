# VAGE Clothing — Transactional Order Emails

VAGE sends two transactional emails only after a payment has been confirmed:

1. **Order confirmation** — order number, purchased items, variants, quantities, discounts, delivery amount, total and shipping address.
2. **Payment receipt** — the same order details plus payment method, provider, payment reference and payment date.

Failed, cancelled, pending and abandoned payments do not enqueue either email. A payment being marked PAID is committed to MySQL before email delivery starts. An email-provider failure never reverses a successful payment.

## 1. Create/configure Resend

1. Create or sign in to your account at https://resend.com/.
2. Open **API Keys** and create a server-side API key with permission to send email.
3. Open **Domains** and add a domain you own.
4. Add the exact SPF/DKIM DNS records Resend displays at your domain's DNS provider.
5. Wait until the domain is verified in Resend.
6. Use a sender address on that verified domain, for example \`orders@yourdomain.com\`.

Resend's Node SDK uses \`resend.emails.send(...)\`. VAGE supplies a stable idempotency key for each order email to protect retries from sending duplicate messages. See:
- https://resend.com/nodejs
- https://resend.com/docs/dashboard/emails/idempotency-keys
- https://resend.com/docs/dashboard/domains/introduction

Resend's examples use \`onboarding@resend.dev\` and \`delivered@resend.dev\` as sample sender/recipient values. For VAGE customer emails, verify a domain you control and use a sender on that domain.

## 2. Configure local environment

Add the following to the existing \`.env.local\`; do not overwrite other database, JWT, payment or cron variables:

\`\`\`env
RESEND_API_KEY=re_your_real_api_key
EMAIL_FROM=VAGE Clothing <orders@your-verified-domain.com>
EMAIL_REPLY_TO=support@your-verified-domain.com
\`\`\`

Replace the example addresses with an address on the domain you verified. Never paste the API key into chat, browser code, GitHub or \`.env.example\`.

Restart the Next.js development server after saving \`.env.local\`.

## 3. Trigger the first VAGE email

1. Sign in to VAGE.
2. Add a product variant to the cart.
3. Complete checkout in local DEMO mode.
4. Choose UPI, Card, Net Banking or Wallet.
5. Enter the displayed local demo OTP and select **Successful payment**.
6. VAGE confirms the order in MySQL and queues the order confirmation and payment receipt.
7. Open the order-success page and check the **Order emails** section.

The DEMO OTP is a local simulation code; it is not sent by email or SMS. No real payment is collected in DEMO mode.

## 4. Diagnose failed delivery

Run this in MySQL Workbench:

\`\`\`sql
USE vage_clothing;

SELECT
  email_outbox_id,
  event_type,
  recipient_email,
  status,
  attempts,
  last_error,
  provider_message_id,
  sent_at,
  updated_at
FROM email_outbox
ORDER BY email_outbox_id DESC
LIMIT 20;
\`\`\`

Use \`last_error\` to find the exact provider rejection, such as a missing API key, invalid API key, unverified sender or rejected recipient. Fix the Resend configuration, restart the app, then click **Retry order emails** on the paid order's confirmation page.

Resend idempotency keys are also used on sends. A repeated request with the same key and same payload is designed to prevent duplicate sending.

## 5. Background outbox worker

For a deployed environment, schedule a POST request to:

\`/api/cron/dispatch-email-outbox\`

with the header:

\`Authorization: Bearer <CRON_SECRET>\`

A one-minute schedule is appropriate for this small transactional outbox. Keep \`CRON_SECRET\` private. The worker automatically retries failed messages with a delay, up to five automatic attempts; a customer can also manually retry emails for a paid order.

## Behaviour summary

- **Payment success:** order and receipt emails are queued and sent.
- **Payment failure/user dropped:** stock and coupon reservation are restored; no order email is sent.
- **Payment pending:** stock remains reserved; no order email is sent.
- **Email failure:** the paid order remains paid; the outbox records the error for retry.

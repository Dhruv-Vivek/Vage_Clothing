# VAGE Clothing — Dedicated Gmail Mailbox

VAGE uses one dedicated Gmail mailbox for both outgoing order notifications and incoming Contact Us messages.

Example address: vageclothing@gmail.com (only if available). Create a dedicated store account rather than using a personal mailbox.

## What the mailbox does

- Sends order confirmation emails to customers after a verified successful payment.
- Sends payment receipts to customers after a verified successful payment.
- Receives notifications for Contact Us submissions.
- Receives customer replies to support conversations.
- Sends an acknowledgement email to each customer who submits the Contact Us form.

Failed, pending, abandoned and cancelled payments do not generate paid-order emails.

## 1. Apply the Contact Us database migration

After pulling this branch, open and execute the following file in MySQL Workbench:

`database/vage-gmail-contact-migration.sql`

It creates the contact_messages table used to persist customer enquiries and track notification/acknowledgement email delivery. It is additive and does not modify existing users, orders, products or inventory.

## 2. Create the VAGE Gmail account

1. Open https://accounts.google.com/signup
2. Create a dedicated VAGE mailbox such as vageclothing@gmail.com, if it is available.
3. Use a strong, unique account password.
4. Enable 2-Step Verification.
5. Keep account recovery information up to date.

Do not use your normal Gmail password in the application.

## 3. Generate a Google App Password

Gmail SMTP requires an App Password for this Nodemailer setup. Google requires 2-Step Verification before the App Password option appears. App Passwords are not offered for every account (for example, some Advanced Protection or managed accounts).

1. Sign in to the VAGE Gmail account.
2. Open https://myaccount.google.com/apppasswords
3. Generate an App Password for the VAGE application.
4. Copy the 16-character password and store it safely.

Google describes App Passwords as a fallback for apps that cannot use Sign in with Google and recommends OAuth when available. Never share the App Password or commit it to GitHub.

Official Google guidance: https://support.google.com/mail/answer/185833

## 4. Configure local environment

Append these settings to the existing .env.local. Keep all existing database, JWT, payment and cron settings unchanged.

~~~~env
GMAIL_USER=vageclothing@gmail.com
GMAIL_APP_PASSWORD=the_16_character_google_app_password
VAGE_CONTACT_TO=vageclothing@gmail.com
~~~~

Replace the sample address with the exact Gmail address you created. VAGE_CONTACT_TO can be another mailbox later; it defaults to GMAIL_USER.

The app uses Gmail SMTP through Nodemailer. The account's normal password is never used. These variables are server-side only and must never use NEXT_PUBLIC_ prefixes.

## 5. Order confirmation and payment receipt

When the order is marked PAID after server-side payment verification:

1. VAGE creates two email-outbox records within the same database transaction that confirms the payment.
2. The outbox worker sends an order confirmation and a payment receipt to the customer's account email.
3. The sender is the dedicated VAGE Gmail account.
4. Customer replies go to VAGE_CONTACT_TO.
5. Delivery status and provider errors are stored in MySQL and displayed on the order-success page.

An email failure never changes a paid order back to unpaid. The outbox has a bounded retry policy and supports manual retry from the customer's paid order page.

## 6. Contact Us messages

The Contact page saves each valid submission to the contact_messages MySQL table.

It then sends:
- A notification email to VAGE_CONTACT_TO, with Reply-To set to the customer's email so the VAGE team can reply directly.
- An acknowledgement email to the customer, confirming the message reached VAGE.

If Gmail is temporarily unavailable, the message remains saved in MySQL. Notification and acknowledgement delivery statuses are tracked separately and the scheduled email worker retries them.

The form includes server-side validation, a honeypot field and a per-email hourly submission limit.

## 7. Gmail sending limits

Personal Gmail accounts have daily sending and recipient limits. Google documents a standard limit of 500 messages/recipients per day for many consumer account scenarios; the precise limits depend on account type and usage. This mailbox is intended for the low-volume VAGE college demonstration, not bulk production marketing or high-volume transactional traffic.

Google limits guidance: https://support.google.com/mail/answer/22839

For a production store with larger order volume, use a dedicated transactional mail service and a verified domain.

## 8. Troubleshooting

If an order email fails, use the order-success page's Order emails section and Retry order emails action.

For Contact Us notifications, inspect the contact_messages statuses and error fields in MySQL:

~~~~sql
USE vage_clothing;

SELECT
  contact_message_id,
  full_name,
  email,
  subject,
  notification_status,
  notification_attempts,
  notification_last_error,
  acknowledgement_status,
  acknowledgement_attempts,
  acknowledgement_last_error,
  created_at
FROM contact_messages
ORDER BY contact_message_id DESC
LIMIT 20;
~~~~

After correcting Gmail configuration, the scheduled endpoint /api/cron/dispatch-email-outbox can retry order and contact emails. It requires the Authorization: Bearer CRON_SECRET header.

Restart the Next.js development server after changing .env.local.

# VAGE Batch 7 — Admin Dashboard

## Included in this slice

- Database-backed admin authorization. Every admin API request resolves the signed-in user against MySQL and requires role `ADMIN` and an active account.
- Overview metrics: paid revenue, total/paid orders, fulfilment queue, active customers, low-stock variants and contact-email follow-up count.
- Six-month successful-payment revenue trend, order-status distribution and recent orders.
- Searchable, paginated order browser with order and payment status filters.
- Searchable customer Contact Us inbox with notification and acknowledgement delivery status.
- Admin navigation link displayed only when the signed-in user record has role `ADMIN`.

## Promote the first administrator

The existing users table already supports `CUSTOMER` and `ADMIN`. Public registration always creates `CUSTOMER` accounts.

1. Create an ordinary VAGE account through the storefront.
2. Open `database/vage-batch7-admin-bootstrap.sql`.
3. Replace both occurrences of `replace-with-your-admin-email@example.com` with the email address of the account you control.
4. Execute the script in MySQL Workbench.
5. Verify the selected row shows `role = ADMIN` and `is_active = 1`.
6. Log out and sign back in so the account context is refreshed.

Do not expose an admin role field in public registration. The SQL script only promotes an existing active account; it does not create a user or change a password.

## Routes

- `/admin` — overview
- `/admin/orders` — order browser
- `/admin/messages` — Contact Us inbox
- `GET /api/admin/dashboard`
- `GET /api/admin/orders`
- `GET /api/admin/messages`

All admin APIs return 401 for no valid session and 403 for a signed-in non-admin. Hiding the navigation link is a usability measure only; server-side checks enforce access.

## Scope note

This initial Batch 7 slice is read-only for orders and contact messages. It does not alter payment status or order fulfilment state. Status-changing actions, audit attribution, status-change customer emails and message workflow controls should be added in a later Batch 7 sub-phase after the read-only routes are tested locally.

## Local validation

After pulling the branch and promoting an admin account:

```powershell
npm run build
npm run dev
```

Then test both access paths:
- An admin account can load the dashboard, order list and contact inbox.
- A normal customer account receives 403 from each admin API and cannot see the Admin navigation link.

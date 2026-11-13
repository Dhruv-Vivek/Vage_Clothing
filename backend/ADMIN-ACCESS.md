# Admin access

VAGE does not use a separate admin login page or a shared admin password.

1. Register a normal customer account or use your existing customer account.
2. In MySQL Workbench, run `database/promote-existing-user-to-admin.sql`.
3. Replace the script's `@admin_email` value with the exact email used for your VAGE login.
4. Confirm the final SELECT shows `role = 'ADMIN'` and `is_active = 1`.
5. Log out of VAGE and sign in again with the same email and password.
6. Open `http://localhost:3000/admin`.

The admin layout calls `requireAdminPage()`, which checks the authenticated user's current role from MySQL. A normal CUSTOMER account is redirected to the storefront. The SQL script promotes an existing active account; it does not create a default admin, change a password, or bypass authentication.

Never run this promotion against an account you do not control. Do not paste passwords, password hashes, or JWT secrets into SQL scripts or GitHub.

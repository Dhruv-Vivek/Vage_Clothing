# Vage Clothing — Batch 3: MySQL-backed authentication

This patch replaces the Batch 1 mock/localStorage authentication with registration, login, session verification and logout backed by the existing `vage_clothing` MySQL database.

## Files

New:
- `src/lib/auth.js`
- `src/app/api/auth/register/route.js`
- `src/app/api/auth/login/route.js`
- `src/app/api/auth/me/route.js`
- `src/app/api/auth/logout/route.js`

Updated:
- `src/context/AuthContext.jsx`
- `src/components/LoginModal.jsx`
- `src/app/membership/page.jsx` (temporarily prevents the old mock button from falsely activating a membership; real membership checkout is a later batch)
- `.env.example`

## Before applying

Commit/push the completed Batch 1 and Batch 2 work on your `next-migration` branch. This batch should be applied as a separate commit.

## Install dependencies

From the repository root:

```powershell
npm install bcryptjs jose
```

## Configure JWT secret

Generate a random secret in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Open the existing `.env.local` and add the generated value:

```env
JWT_SECRET=PASTE_THE_GENERATED_VALUE_HERE
```

Keep your existing `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_CONNECTION_LIMIT` values. Do not overwrite `.env.local`, do not share it, and do not commit it.

The `users.phone` column accepts 10–15 digits under the existing MySQL CHECK constraint. The registration endpoint strips display separators and stores digits only, so a phone typed as `+91 98765 43210` is stored as `919876543210`.

## Apply

Extract the ZIP into the project root, preserving folders. It contains only the files listed above.

## Run and test

```powershell
npm run build
npm run dev
```

Test in browser:
- `http://localhost:3000/api/auth/me` — before login should return `{ "user": null }`.

Use the existing Navbar Login button to test registration and login. Registration creates a `users` record and one ACTIVE cart in a MySQL transaction, hashes the password using bcrypt, and sets a 7-day HTTP-only JWT cookie.

After registering, refresh the page. The Navbar should still show the signed-in customer. Log out and verify `/api/auth/me` returns a null user. Then log in again with the same credentials.

API requests can also be tested from PowerShell:

```powershell
$body = @{
  fullName = 'Test Customer'
  email = 'test.customer@example.com'
  phone = '+91 98765 43210'
  password = 'VageTest@123'
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/auth/register' -ContentType 'application/json' -Body $body -SessionVariable vageSession
Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/me' -WebSession $vageSession
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/auth/logout' -WebSession $vageSession
```

Use a unique test email or remove the test account through a deliberate, reviewed database operation; registration correctly rejects duplicate email addresses.

## Security and scope notes

- Password hashes only are stored in MySQL. Passwords and JWTs are never stored in localStorage.
- The JWT is held in a `HttpOnly`, `SameSite=Lax` cookie, with `Secure` enabled in production.
- `/api/auth/me` resolves the signed user ID against MySQL on each request, so disabled accounts are not treated as authenticated.
- The existing user role values are uppercase `CUSTOMER` and `ADMIN`; the database default assigns `CUSTOMER` during registration. Public responses contain no password hash.
- Membership is deliberately not activated by the old frontend button. The database currently has no membership/subscription tables; membership persistence and payment are a separate later batch.
- Add production rate limiting, email verification and password reset before any public deployment.

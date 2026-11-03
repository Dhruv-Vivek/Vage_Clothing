# VAGE Clothing

VAGE is a dark, premium clothing e-commerce application built with Next.js. The current application uses MySQL as its transactional source of truth for customers, catalogue data, inventory, carts, orders, payments, memberships and customer account data.

## Technology stack

- Frontend and application server: Next.js 15 App Router, React 19
- Styling and motion: Tailwind CSS 3, Framer Motion
- UI icons: Lucide React
- Relational database: MySQL 8
- Database driver: mysql2
- Authentication: bcryptjs password hashing and signed JWT HttpOnly cookies using jose
- Payments: Razorpay and Cashfree integrations, plus a development-only DEMO payment provider
- Email: Gmail SMTP through Nodemailer, with a MySQL email outbox
- Version control: Git and GitHub

MongoDB and vector search are not currently integrated in this branch. MySQL remains the source of truth for all implemented e-commerce transactions.

## Application capabilities

### Storefront and catalogue

- Responsive home page, product catalogue and product detail pages
- MySQL-backed product/category APIs
- Search, category, price and stock filters
- Variant-aware product selection by size and colour
- Guest cart and wishlist state

### Authentication and checkout

- MySQL-backed registration, login, logout and session verification
- bcrypt password hashes and HttpOnly session cookies
- Server-side checkout price and stock validation
- Inventory reservation and restoration
- Coupon validation and idempotent order creation
- Razorpay/Cashfree payment verification and durable webhook processing
- Order confirmation and payment receipt email outbox

### Membership

- Membership plans and benefits loaded from MySQL
- Razorpay membership checkout
- Membership activation only after verified payment capture
- 30-day renewal window for the same plan
- Renewal history and current membership state
- No automatic renewal

### Customer account

- Profile view and update
- Saved address book with default-address management
- Persistent MySQL wishlist for signed-in customers
- Guest wishlist merge at sign-in
- Paginated order history
- Order detail, delivery progress and status history
- Saved-address selection during checkout

### Customer support

- Contact form backed by MySQL
- Gmail notifications to the VAGE support mailbox
- Customer acknowledgement messages
- Retryable email delivery status

## Main customer routes

| Route | Purpose |
|---|---|
| / | Home page |
| /products | Product catalogue |
| /products/[id] | Product details and variant selection |
| /cart | Shopping cart |
| /checkout | Shipping, delivery and payment |
| /order-success | Payment/order result |
| /membership | Membership plans, purchase and history |
| /account | Customer profile and account hub |
| /account/addresses | Saved address book |
| /account/orders | Customer order history |
| /account/orders/[id] | Order detail and delivery progress |
| /favorites | Wishlist |
| /about | About VAGE |
| /contact | Contact form and support information |

## API areas

| API prefix | Purpose |
|---|---|
| /api/auth/* | Authentication and current session |
| /api/products/* | Product catalogue and product details |
| /api/categories | Category listing |
| /api/checkout/* | Server-side order creation |
| /api/payments/* | Payment verification and reconciliation |
| /api/webhooks/* | Payment provider webhooks |
| /api/membership/* | Membership plans, purchase, verification and reconciliation |
| /api/account/* | Profile, saved addresses, wishlist and order history |
| /api/orders/* | Owner-scoped order details and email retry |
| /api/contact | Contact message persistence |
| /api/cron/* | Protected email/webhook and pending-order workers |

## Local development

Requirements:

- Node.js 22 or a compatible supported Node.js version
- MySQL 8
- A local .env.local file with database, JWT and provider configuration

Install and run:

~~~~powershell
npm ci
npm run dev
~~~~

Run a production build locally:

~~~~powershell
npm run build
npm start
~~~~

Lint:

~~~~powershell
npm run lint
~~~~

The MySQL connection pool is implemented in src/lib/db.js. It is server-only. Never expose database credentials or payment secrets through NEXT_PUBLIC_ variables.

## Environment variables

Configure these in .env.local (do not commit the file):

- DB_HOST
- DB_PORT
- DB_USER
- DB_PASSWORD
- DB_NAME
- DB_CONNECTION_LIMIT
- JWT_SECRET
- PAYMENT_PROVIDER
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- RAZORPAY_WEBHOOK_SECRET
- Cashfree sandbox credentials when using Cashfree
- GMAIL_USER
- GMAIL_APP_PASSWORD
- VAGE_CONTACT_TO
- CRON_SECRET

Use test/sandbox payment credentials during development. Do not switch to live payment credentials until the complete payment lifecycle has been tested and production security/configuration is reviewed.

## Database migrations

SQL schema and migration files are stored in the database directory.

For membership and customer account features, follow:

1. Back up the local vage_clothing database.
2. Open database/vage-phase9-10-membership-account-migration.sql in MySQL Workbench.
3. Execute the complete script against vage_clothing.
4. Verify membership_plans, user_memberships, membership_payment_transactions, saved_addresses and wishlist_items.
5. Follow PHASE-9-10-MEMBERSHIP-ACCOUNT.md for membership/account verification.

The Phase 9–10 migration is additive. Saved addresses are stored separately from the existing addresses table, which remains the order-specific delivery snapshot.

## Important development notes

- Browser-submitted prices are not authoritative. Checkout and membership prices are read from MySQL on the server.
- Membership benefits are activated only after a captured payment is confirmed by Razorpay.
- Payment authorisation alone does not activate membership.
- A signed-in customer's order, address and wishlist APIs are scoped to that customer's authenticated identity.
- Membership renewal is customer-initiated during the final 30 days. Automatic renewal is not enabled.
- Do not expose the local development server through a public tunnel except when testing provider webhooks, and stop the tunnel after testing.

## Project documentation

- BATCH6.2-RAZORPAY-CHECKOUT.md — Razorpay checkout and webhook setup
- EMAIL-SETUP.md — Gmail SMTP and Contact Us email setup
- PHASE-9-10-MEMBERSHIP-ACCOUNT.md — Membership and customer account migration, routes and verification checklist

Before merging or deploying, run the local build/lint commands, apply migrations to a test database, and complete the payment, email, membership and customer-account verification checklists.

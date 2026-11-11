# VAGE Backend and Embedded MySQL Walkthrough

This folder contains the server-side application layer for VAGE. It is organized so that database connection code and backend services are easy to find and explain.

## Folder structure

```text
backend/
├── README.md
├── database/
│   └── connection.js          # mysql2/promise pool + parameterized query()
├── services/
│   ├── account-validation.js
│   ├── admin.js
│   ├── admin-products.js
│   ├── api.js
│   ├── auth.js
│   ├── cart.js
│   ├── checkout-pricing.js
│   ├── contact-email.js
│   ├── email-events.js
│   ├── gmail-mailer.js
│   ├── guards.js
│   ├── membership.js
│   ├── mongodb.js
│   ├── order-email.js
│   ├── order-lifecycle.js
│   ├── order-payments.js
│   ├── order-reconciliation.js
│   ├── orders.js
│   ├── product-intelligence.js
│   ├── razorpay-webhook-worker.js
│   ├── razorpay.js
│   ├── shipping.js
│   ├── validate.js
│   └── payments/
│       ├── cashfree.js
│       └── config.js
└── sql/
    └── embedded-mysql-examples.sql
```

Client-safe helpers remain in `src/lib` (for example `format.js`, `order-status.js`, `product-intelligence-client.js` and `utils.js`). Files left under `src/lib` for server features are compatibility exports that forward old imports to the canonical implementation under `backend/`. This avoids changing dozens of existing imports at once.

## Why are API route files still under src/app/api?

Next.js discovers HTTP endpoints from the `src/app/api/**/route.js` file structure. These files are the HTTP/controller layer. They authenticate and validate requests, call backend services, and return JSON responses. They are deliberately not moved because moving them would remove or change the existing application endpoints.

The database connection and reusable server-side services are in this `backend/` folder. Some route handlers also contain short, route-specific SQL statements; the comments in those handlers identify the embedded SQL sections. Razorpay/Cashfree webhooks, payment callbacks and scheduled workers must remain reachable as HTTP endpoints.

## What “embedded SQL” means in this JavaScript project

VAGE embeds SQL statements directly in JavaScript server-side source files and executes them through the `mysql2/promise` driver. For example:

```js
const rows = await query(
  `SELECT p.product_id, p.name, c.name AS category_name
   FROM products AS p
   INNER JOIN categories AS c
     ON c.category_id = p.category_id
   WHERE p.status = ?`,
  ['ACTIVE']
);
```

The SQL text is part of the JavaScript program. The `?` placeholders are bound values; do not concatenate customer input into SQL strings. The `query()` helper in `backend/database/connection.js` executes parameterized statements using the shared pool. Transactional operations use a connection and execute their SQL with `connection.execute()`.

**Terminology note:** This is application-level SQL embedded in JavaScript using a database driver. It is not the older precompiler-based Embedded SQL syntax used in languages such as C with `EXEC SQL`. This distinction is useful if asked in a DBMS viva.

## Where to demonstrate the SQL concepts

| DBMS concept | Where to open it |
|---|---|
| MySQL connection and SQL execution | `backend/database/connection.js` |
| DDL — CREATE TABLE / ALTER TABLE | `database/vage-phase9-10-membership-account-migration.sql`, `database/vage-order-payment-gateway-migration.sql` |
| DML — INSERT / UPDATE / DELETE | `backend/services/cart.js`, `backend/services/membership.js`, `backend/services/order-lifecycle.js`, `backend/services/order-payments.js` |
| SELECT with JOIN | `backend/services/admin-products.js`, `src/app/api/products/route.js`, `src/app/api/categories/route.js` |
| Correlated subquery | `src/app/api/account/orders/route.js` |
| Transaction / row locking | `src/app/api/checkout/route.js`, `backend/services/checkout-pricing.js`, `backend/services/order-payments.js` |
| Triggers | `schema_dump.sql` — inventory audit and order-status history/guard triggers |
| Stored procedures | `schema_dump.sql`; address endpoints show how a stored procedure is called with `CALL` |
| MongoDB NoSQL aggregation | `backend/services/product-intelligence.js` |

For the actual schema objects, use the migration files and schema reference; the SQL examples in `backend/sql/` are an instructor-friendly index/reference, not an additional migration to apply.

## A good demo sequence for the teacher

1. Open `backend/database/connection.js` and explain the MySQL pool, `query(sql, params)`, prepared placeholders and server-only restriction.
2. Open `src/app/api/products/route.js` and show a SELECT query with INNER JOIN and parameterized filters.
3. Open `src/app/api/account/orders/route.js` and explain the correlated subquery used to calculate item count for each order.
4. Open `src/app/api/checkout/route.js` and show a transaction: begin, SELECT ... FOR UPDATE, INSERT order/order_items/payment, UPDATE inventory and commit/rollback.
5. Open `database/vage-phase9-10-membership-account-migration.sql` for DDL and `schema_dump.sql` for triggers/procedures.
6. Open `backend/services/product-intelligence.js` and explain that product events are resolved using MySQL, then written/aggregated in MongoDB.

## Important safety notes

- Keep database credentials in the server-only `.env.local`; never put them in a `NEXT_PUBLIC_*` variable or browser code.
- Do not move Next.js route handlers out of `src/app/api`.
- Do not run `schema_dump.sql` over an existing database. It contains destructive `DROP TABLE` statements and is a schema reference/restore script.
- Apply only the documented additive migrations, after checking whether each migration has already been applied.
- Existing Razorpay, Cashfree, Gmail, membership, COD and webhook service code remains in place under `backend/services`.

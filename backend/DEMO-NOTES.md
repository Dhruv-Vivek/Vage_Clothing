# DBMS mini-project demo notes

## Honest architecture explanation

"VAGE uses MySQL 8 as its transactional database. The Next.js server connects through mysql2/promise. The connection pool is in src/lib/db.js. SQL statements are executed from server-only JavaScript modules using parameterized statements. Interactive client pages currently communicate with Next.js route handlers under src/app/api; those handlers execute or invoke the database modules. The Admin SQL Lab is a Server Component that directly invokes advanced SQL functions without a browser API fetch."

Do not claim that the entire application is API-free. Browser code must never connect directly to MySQL or receive database credentials.

## Recommended live demo

1. `schema_dump.sql`: show tables, primary/foreign keys, views, triggers and stored procedures.
2. `src/lib/db.js`: show MySQL pool and `pool.execute(sql, params)`.
3. `src/app/api/checkout/route.js`: show the parameterized `CALL place_order(?, ?, ?, ?, ?)`.
4. `schema_dump.sql`: show the `place_order`, `confirm_payment`, and `set_default_address` procedure definitions.
5. `src/lib/orders.js`: show transaction-aware order operations, joins, row locking and history handling.
6. Storefront → Products: explain the product filter/search query; `src/app/api/products/route.js` uses full-text search and `COUNT(*) OVER()` for pagination.
7. Admin → SQL Lab: show CTEs, window functions and correlated subqueries rendered by a server component.
8. Open `database/advanced-demo-queries.sql` in MySQL Workbench to execute the same three read-only reports.

## Advanced SQL concepts

- CTEs (`WITH`): named logical stages in multi-step reports.
- Window functions: `RANK`, `DENSE_RANK`, `COUNT(*) OVER`, `AVG() OVER` and `NTILE`.
- Correlated subqueries: nested queries referring to the current outer row.
- JOINs and aggregation: combine related normalized tables and compute business metrics.
- CASE: classify inventory and product performance.
- Stored procedures: `place_order` builds an order within MySQL; the application invokes it with parameterized `CALL`.
- Triggers: inventory audit and order-status history/guard logic run when relevant rows change.
- Transactions and row locks: keep multi-step checkout/order updates consistent.
- Parameterized SQL: bind user values rather than concatenating them into SQL.

## What "no APIs" could mean

These are different:
- External provider APIs: Razorpay/Cashfree payments and email delivery integrations.
- Internal Next.js HTTP routes: `src/app/api/**/route.js`, called by some browser components.

The current application still uses internal route handlers for interactive flows. The SQL Lab demonstrates the Server Component → server-only query module → MySQL pattern without a browser API call. Removing every internal route needs a separate migration of each page/context and all authentication, checkout, payment, webhook and admin workflows. It is not safe to put SQL or DB credentials in browser components.

## Safety

The SQL Lab and `database/advanced-demo-queries.sql` are read-only. Use a test database for write demonstrations. Do not execute destructive DDL during the evaluation.

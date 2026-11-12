# VAGE Clothing backend map

This folder contains the backend navigation guide and DBMS demonstration material. The live Next.js server implementation remains under `src/app` and `src/lib` so Next.js routing and imports continue working.

## Actual database access

- `src/lib/db.js`: server-only MySQL connection pool (`mysql2/promise`).
- SQL is executed with `pool.execute(sql, params)`; values are parameterized.
- `src/lib/admin-products.js`, `src/lib/orders.js`, `src/lib/membership.js`, `src/lib/product-intelligence.js` and other server-only modules contain business SQL.
- `src/app/api/**/route.js`: existing Next.js HTTP route handlers. Interactive browser components still call some of these routes.
- `src/lib/advanced-sql.js`: read-only MySQL 8 analytics using CTEs, window functions, correlated subqueries, joins, aggregation and CASE.
- `src/app/admin/sql-lab/page.jsx`: protected React Server Component that calls `advanced-sql.js` directly. This page does not call an internal browser API.
- `src/lib/mongodb.js` and `src/lib/product-intelligence.js`: MongoDB event-document storage and aggregation; the repository does not currently demonstrate Atlas Vector Search.

## Database scripts

- `schema_dump.sql`: canonical schema dump, including existing views, triggers and stored procedures.
- `database/`: incremental migrations and `advanced-demo-queries.sql` (read-only MySQL 8 demonstration queries).

## Important architecture distinction

SQL does not execute in browser React code. Browser code sends user intent to a trusted Next.js server entry point; the server validates identity and inputs, then executes parameterized SQL. Database credentials remain on the server.

The existing application still has internal `/api/*` route handlers. The SQL Lab demonstrates a direct Server Component → server-only SQL module → MySQL path, but it does not remove all existing API routes. A complete removal requires migrating each client workflow to Server Actions/Server Components and carefully preserving auth, checkout, provider webhooks and other integrations.

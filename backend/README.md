# VAGE Clothing backend map

This directory is a teaching/documentation and database-artifact layer. The live Next.js server implementation remains under `src/app/api` and `src/lib` so imports and routes continue working. Moving those modules physically without rewriting all imports, route handlers, and Next.js conventions would break the application.

## Actual database access

- `src/lib/db.js`: server-only MySQL connection pool (`mysql2/promise`).
- SQL is executed with `pool.execute(sql, params)`; values are parameterized.
- `src/lib/admin-products.js`, `src/lib/orders.js`, `src/lib/membership.js`, `src/lib/product-intelligence.js` and other server-only modules contain business SQL and database calls.
- `src/app/api/**/route.js`: Next.js server route handlers. Browser code currently calls these routes. These ARE API endpoints; do not describe the current app as API-free.
- `src/lib/mongodb.js` and `src/lib/product-intelligence.js`: MongoDB event-document storage and aggregation. The repository's current Phase 8 code is behavioural event analytics, not demonstrated MongoDB Atlas Vector Search.

## Database scripts

The canonical schema is `schema_dump.sql`; incremental database changes are in `database/`. Keep those migration files in their existing locations to avoid duplicating the source of truth.

## Important for the DBMS demonstration

The instructor's requirement "no APIs" is not satisfied merely by organising files. The current frontend makes HTTP requests to Next.js `/api` routes, and those handlers call server-only SQL modules. A true no-API requirement needs an architecture decision: database calls cannot safely run in browser JavaScript because that would expose database credentials. For a class demonstration, show the SQL source and its server-side JavaScript invocation. Ask whether server-side Next.js route handlers count as APIs under the instruction before attempting a potentially breaking rewrite.

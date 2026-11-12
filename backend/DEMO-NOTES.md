# DBMS mini-project demo notes

## Honest architecture explanation

"VAGE uses MySQL 8 as its transactional database. The Next.js server connects through mysql2/promise. The connection pool is in src/lib/db.js. SQL statements are executed from server-only JavaScript modules using parameterized statements. The UI currently communicates with server route handlers under src/app/api; those handlers invoke the database modules. Database credentials are not sent to the browser."

If asked whether the current application has APIs: say yes, the Next.js route handlers are HTTP APIs. Do not claim that the current code is API-free. If the faculty prohibits *all* API routes, clarify whether server-side route handlers are included in that prohibition before changing architecture.

## Where to show SQL-to-JavaScript invocation

1. Open `src/lib/db.js` and show `query(sql, params)`, which calls `getPool().execute(sql, params)`.
2. Open `src/lib/admin-products.js` and show parameterized SELECT/INSERT statements.
3. Open `src/lib/orders.js` and `src/lib/membership.js` for transaction/business operations.
4. Open corresponding route files under `src/app/api/` to show the call path from HTTP handler to server-side JS and SQL module.

## DDL / DML / joins

- DDL: `schema_dump.sql` and `database/*.sql` contain CREATE TABLE / ALTER TABLE statements.
- DML: server modules contain SELECT, INSERT, UPDATE and DELETE SQL.
- Joins: examples are in `src/lib/admin-products.js` and related catalogue/order modules.
- Transactions: inspect order/membership operations for beginTransaction/commit/rollback logic before presenting a particular example.
- Triggers: schema_dump.sql includes inventory audit and order-status triggers; inspect the exact trigger definition in MySQL Workbench.

## NoSQL

MongoDB is used in Phase 8 to store product-view/search/cart behavioural event documents and execute aggregation pipelines. This is not the same as vector search. The repository's product-intelligence path does not establish that Atlas Vector Search is implemented. Do not claim vector search unless a vector index and $vectorSearch query are actually added and configured.

## Suggested live sequence

1. Explain MySQL is the transactional source of truth.
2. Show the database schema and key relationships in MySQL Workbench.
3. Show one JOIN query and one correlated-subquery example from a SQL demo script or run one read-only query live.
4. Show a trigger and explain the automatic audit/history insertion.
5. Show the JS database pool and parameterized execute call.
6. Show the business module invoking that SQL helper.
7. Explain the Next.js route handler is the HTTP layer used by the current frontend.
8. Explain MongoDB's event documents and aggregation separately from MySQL.

Use a test database for all write demonstrations. Do not execute destructive DDL during the presentation.

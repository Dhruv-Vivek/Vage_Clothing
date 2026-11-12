# SQL-to-UI data flow

## What can safely run in each layer

**Browser / React Client Components**
- Manage presentation state (selected size, filter values, open modals).
- Submit user intent to a server entry point.
- Never import `mysql2`, read DB environment variables, or execute SQL.

**Next.js server**
- Owns authentication and authorization.
- Uses server-only JavaScript modules with embedded, parameterized SQL.
- Can render a Server Component by querying MySQL directly (no browser fetch to an internal route).
- For existing interactive client pages, current `/api/*` route handlers remain the transport layer and call SQL modules.

**MySQL 8**
- Enforces relational constraints, triggers, stored procedures, and transactions.
- Performs joins, CTEs, window functions, correlated subqueries, aggregation and filtering.

## Existing vs new code

- Existing client pages call internal paths such as `/api/products`, `/api/cart`, `/api/orders` and `/api/membership`.
- Those route handlers execute or call server-side SQL code. They are not a substitute for SQL; they are the HTTP boundary.
- `src/app/admin/sql-lab/page.jsx` is a Server Component that directly calls `src/lib/advanced-sql.js`. Its DB-backed report has no browser-side fetch or direct browser-to-MySQL connection.
- `database/advanced-demo-queries.sql` contains the same read-only MySQL 8 concepts for MySQL Workbench.

## Advanced SQL used by SQL Lab

| SQL concept | Example | Purpose |
|---|---|---|
| CTE (`WITH`) | `inventory_snapshot`, `paid_product_sales`, `customer_spend` | Break complex reports into readable logical stages |
| Window functions | `DENSE_RANK`, `RANK`, `AVG() OVER`, `NTILE` | Rank products/customers without collapsing rows |
| Correlated subqueries | Latest stock reason; latest lifetime paid order | Derive a row-specific related value |
| Multi-table JOIN | products, categories, variants, inventory, orders, order_items, users | Combine relational records |
| Aggregation | `SUM`, `COUNT(DISTINCT)`, `AVG`, `MAX` | Compute business metrics |
| Conditional logic | `CASE` | Classify inventory and product performance |
| Parameterized SQL | `INTERVAL ? DAY` | Keep user input out of SQL string concatenation |

## Important scope statement

This adds a Server Component / server-only SQL example and advanced SQL-backed screens. It does **not** remove all existing `/api/*` routes from the application. Converting every client request to Server Actions or server-rendered data requires a separate migration of all pages, contexts, payment callbacks, webhooks and admin workflows. Browser-to-MySQL SQL is not a safe substitute.

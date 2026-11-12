# Backend source map

| Concern | Runtime source | Notes |
|---|---|---|
| MySQL connection | `src/lib/db.js` | Server-only mysql2/promise pool |
| Product/catalogue SQL | `src/app/api/products/route.js`, `src/lib/admin-products.js` | Full-text search, joins, filtering, pagination with `COUNT(*) OVER()` |
| Order listing | `src/app/api/orders/route.js` | Authenticated, parameterized query and window-count pagination |
| Orders/checkout | `src/lib/orders.js`, `src/lib/order-payments.js`, `src/app/api/checkout/route.js` | Transaction logic and `CALL place_order(...)` |
| Membership | `src/lib/membership.js`, membership route handlers | MySQL operations and verified-payment lifecycle |
| Auth | `src/lib/auth.js`, auth route handlers | Signed cookie + current user lookup in MySQL |
| Advanced SQL reports | `src/lib/advanced-sql.js`, `src/app/admin/sql-lab/page.jsx` | Server Component calls embedded SQL directly |
| MongoDB | `src/lib/mongodb.js`, `src/lib/product-intelligence.js` | Behavioural event documents and aggregation pipelines |
| MySQL schema | `schema_dump.sql` | Tables, constraints, views, triggers and stored procedures |
| SQL demonstration | `database/advanced-demo-queries.sql` | Read-only CTE/window/correlated-subquery examples |
| Migrations | `database/*.sql` | Incremental schema changes |

This is a navigational map, not a relocation of runtime modules. Keeping runtime code in `src/lib` and `src/app` is intentional: these are the active Next.js application paths.

# Backend source map (current implementation)

| Concern | Actual source of truth | Notes |
|---|---|---|
| MySQL connection | `src/lib/db.js` | mysql2/promise pool, server-only |
| Product/catalogue SQL | `src/lib/admin-products.js`, API product route handlers | Parameterized SELECT/INSERT/UPDATE statements |
| Orders/checkout | `src/lib/orders.js`, `src/lib/order-payments.js`, checkout route handlers | Server-side pricing, stock and transaction logic |
| Membership | `src/lib/membership.js`, membership route handlers | MySQL operations and payment verification flow |
| Auth | `src/lib/auth.js`, auth route handlers | Signed cookie session + MySQL |
| MongoDB | `src/lib/mongodb.js`, `src/lib/product-intelligence.js` | Event documents and aggregation pipelines |
| MySQL schema | `schema_dump.sql` | Complete schema dump, includes triggers in dump |
| Migrations | `database/*.sql` | Incremental schema changes |

This is a navigational map, not a relocation of runtime modules. Keeping source in `src/lib` is intentional: Next.js aliases and relative imports refer to those paths.

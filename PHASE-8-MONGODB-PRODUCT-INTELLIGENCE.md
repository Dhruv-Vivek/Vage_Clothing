# Phase 8 — MongoDB Product Intelligence

## Purpose

Phase 8 adds a behavioural analytics store beside the existing MySQL commerce database. It records what visitors view, search, browse and add to carts, then uses MongoDB aggregation pipelines to produce product and category intelligence for Admin.

Products, categories, inventory, carts, orders, payments, customers and memberships remain in MySQL.

## SQL versus NoSQL data selection

| Data | Store | Why |
|---|---|---|
| Users, roles and authentication | MySQL | Relational integrity and transactional account state |
| Products, categories and variants | MySQL | Authoritative catalogue, foreign keys and joins |
| Inventory and stock movements | MySQL | Strong consistency prevents overselling |
| Carts, orders and order items | MySQL | Transactional checkout and order lifecycle |
| Payments, refunds and memberships | MySQL | Financial and entitlement records need authoritative transactions |
| Product views, searches and browse events | MongoDB | Append-oriented, semi-structured event documents |
| Add-to-cart/remove/quantity activity | MongoDB | Interaction history used for behaviour analysis |
| Popular products, category trends and search rankings | MongoDB aggregation results | Grouping and time-window analysis over event documents |

MySQL remains the system of record. A MongoDB event is not proof of a sale or stock reservation; final checkout totals and inventory are always read and committed through MySQL.

## MongoDB data model

Database: \`vage_product_intelligence\`  
Collection: \`product_events\`

Each document contains an event ID/type, server-resolved product and category snapshots, optional variant/quantity context, a privacy-filtered search term, pseudonymous visitor/session identifiers, a path and server timestamp.

The ingestion endpoint does not accept a client-supplied product name, price or category as authoritative. It resolves product/variant/category values against MySQL before writing to MongoDB. It does not store customer email, phone, full name, IP address or full query-string URLs. Search text is length-limited and email/phone-like patterns are redacted.

Indexes are created by the application when the event collection is first used: unique event ID, time, event type, product, category, search and visitor indexes. No TTL expiry is configured; define a retention period before enabling automatic deletion.

## Environment setup

1. Create a MongoDB Atlas cluster or use a local MongoDB server.
2. Create a database user with read/write access only to the VAGE analytics database.
3. Configure the Atlas network access list for your development machine/server.
4. Add these server-only values to \`.env.local\`:

\`\`\`env
MONGODB_URI=mongodb+srv://<database-user>:<encoded-password>@<cluster-host>/?retryWrites=true&w=majority
MONGODB_DATABASE=vage_product_intelligence
PRODUCT_INTELLIGENCE_ENABLED=true
\`\`\`

Never add the URI to a \`NEXT_PUBLIC_\` variable or commit the real URI. Restart Next.js after changing environment variables.

If MongoDB is not configured, storefront tracking remains best-effort and does not block the customer journey. The Admin page reports MongoDB as unavailable.

## Event ingestion and analytics

- \`POST /api/analytics/events\` accepts validated behavioural events.
- Product/category metadata is resolved against MySQL on the server.
- Logged-in events use the signed-in MySQL user ID. Guest events use browser-generated anonymous/session UUIDs.
- A unique event ID prevents retry duplicates.
- The MongoDB driver connection and indexes are reused across Next.js hot reloads.
- \`GET /api/admin/product-intelligence?days=7|30|90\` is protected by Admin authorization.

The report includes event totals and unique visitors, popular products, category trends, top searches, daily activity in Asia/Kolkata and event-type distribution.

Admin page: \`/admin/product-intelligence\`.

## Python verification script

Install the Python test dependency:

\`\`\`powershell
py -m pip install -r requirements-phase8.txt
\`\`\`

Run it from the repository root:

\`\`\`powershell
py scripts/test_product_intelligence.py
\`\`\`

The script reads \`MONGODB_URI\` from the process environment or local \`.env.local\`, verifies connectivity and indexes, inserts 11 isolated synthetic events, runs summary/product/category/search/event-type aggregation queries, checks unique event ID enforcement and removes its temporary records in a \`finally\` block. It never prints connection credentials and never modifies MySQL.

## Validation checklist

- [ ] Set MongoDB URI and restart Next.js.
- [ ] Run the Python verification script; it should report all checks passed.
- [ ] Sign in as Admin and open \`/admin/product-intelligence\`.
- [ ] Open product detail pages and verify PRODUCT_VIEW events appear.
- [ ] Search for products and verify SEARCH events appear.
- [ ] Browse categories and verify CATEGORY_BROWSE/PRODUCT_LIST_VIEW events appear.
- [ ] Add, remove and change cart quantities; verify corresponding events.
- [ ] Confirm Admin metrics update after refresh and period changes.
- [ ] Confirm guest and signed-in sessions are counted as pseudonymous visitors.
- [ ] Confirm MySQL remains the source of truth for products, orders and stock.

## DBMS Level 3 explanation

MongoDB is suitable for this clickstream activity because events are append-oriented and their shapes vary by interaction type. A product-view event needs product context, a search event needs a search term, and a cart event needs quantity/variant context. A document collection stores these different event shapes without requiring one wide SQL table with many nullable columns.

MongoDB aggregation pipelines use \`$match\`, \`$group\`, \`$sort\`, \`$project\` and \`$limit\` to derive popular products, category trends and top searches. MySQL is retained for structured entities and transactions where foreign keys, joins and atomic updates are essential.

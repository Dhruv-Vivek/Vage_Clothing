-- VAGE EMBEDDED MYSQL — INSTRUCTOR REFERENCE
-- ---------------------------------------------------------------------------
-- This file is a teaching/reference aid, NOT a migration to run.
-- The statements below mirror the SQL patterns used by the application.
-- The ? placeholders are bound by mysql2/promise in JavaScript.
-- For the canonical DDL/migrations, see the root database/ folder.
-- Never run schema_dump.sql over an existing database; it contains DROP TABLE.
-- ---------------------------------------------------------------------------

-- [DDL] A real table definition from the Phase 9–10 migration:
-- CREATE TABLE IF NOT EXISTS wishlist_items (
--   user_id BIGINT UNSIGNED NOT NULL,
--   product_id BIGINT UNSIGNED NOT NULL,
--   created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   PRIMARY KEY (user_id, product_id),
--   KEY idx_wishlist_product_created (product_id, created_at),
--   CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id)
--     REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
--   CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id)
--     REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- [DML] SELECT with INNER JOIN — catalogue and category names:
SELECT
    vc.product_id,
    vc.name,
    vc.base_price,
    c.slug AS category_slug
FROM v_product_catalog AS vc
INNER JOIN products AS p
    ON p.product_id = vc.product_id
INNER JOIN categories AS c
    ON c.category_id = vc.category_id
WHERE p.status = 'ACTIVE'
  AND c.is_active = 1;

-- [QUERY] Correlated subquery — item count for each customer's order:
SELECT
    o.order_id,
    o.order_number,
    (SELECT COALESCE(SUM(oi.quantity), 0)
       FROM order_items AS oi
      WHERE oi.order_id = o.order_id) AS item_count
FROM orders AS o
WHERE o.user_id = ?;

-- [DML] INSERT — add active products to a customer's wishlist:
INSERT IGNORE INTO wishlist_items (user_id, product_id)
SELECT ?, product_id
FROM products
WHERE product_id IN (?, ?, ?)
  AND status = 'ACTIVE';

-- [DML] UPDATE — reserve stock only when enough inventory remains:
UPDATE inventory
SET stock_quantity = stock_quantity - ?
WHERE variant_id = ?
  AND stock_quantity >= ?;

-- [DML] DELETE — remove one wishlist item belonging to the signed-in user:
DELETE FROM wishlist_items
WHERE user_id = ?
  AND product_id = ?;

-- [TRANSACTION PATTERN] This is orchestrated in JavaScript using a checked-out
-- connection: beginTransaction(), SELECT ... FOR UPDATE, INSERT/UPDATE statements,
-- then commit(); catch blocks call rollback().
-- See src/app/api/checkout/route.js and backend/services/order-payments.js.

-- [TRIGGER] Actual trigger definitions are in schema_dump.sql:
--   trg_inventory_audit_update
--   trg_order_status_history_insert
--   trg_order_status_guard
--   trg_order_status_history_update
-- They audit inventory movements and maintain/guard order status history.

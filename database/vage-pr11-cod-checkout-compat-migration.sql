-- VAGE PR #11 COD checkout compatibility fields
-- MySQL 8.0+. Additive and safe to re-run on an existing VAGE database.
USE vage_clothing;

SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'contact_email') = 0,
  'ALTER TABLE orders ADD COLUMN contact_email VARCHAR(190) NULL AFTER user_id',
  'SELECT ''orders.contact_email already exists'' AS migration_note'
);
PREPARE vage_order_contact_email_stmt FROM @ddl;
EXECUTE vage_order_contact_email_stmt;
DEALLOCATE PREPARE vage_order_contact_email_stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'coupon_discount_amount') = 0,
  'ALTER TABLE orders ADD COLUMN coupon_discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER discount_amount',
  'SELECT ''orders.coupon_discount_amount already exists'' AS migration_note'
);
PREPARE vage_order_coupon_discount_stmt FROM @ddl;
EXECUTE vage_order_coupon_discount_stmt;
DEALLOCATE PREPARE vage_order_coupon_discount_stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'membership_discount_amount') = 0,
  'ALTER TABLE orders ADD COLUMN membership_discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER coupon_discount_amount',
  'SELECT ''orders.membership_discount_amount already exists'' AS migration_note'
);
PREPARE vage_order_membership_discount_stmt FROM @ddl;
EXECUTE vage_order_membership_discount_stmt;
DEALLOCATE PREPARE vage_order_membership_discount_stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivery_method') = 0,
  'ALTER TABLE orders ADD COLUMN delivery_method VARCHAR(20) NULL AFTER shipping_amount',
  'SELECT ''orders.delivery_method already exists'' AS migration_note'
);
PREPARE vage_order_delivery_method_stmt FROM @ddl;
EXECUTE vage_order_delivery_method_stmt;
DEALLOCATE PREPARE vage_order_delivery_method_stmt;

-- Confirm all fields used by the COD checkout, online checkout and lifecycle email queries.
SHOW COLUMNS FROM orders LIKE 'contact_email';
SHOW COLUMNS FROM orders LIKE 'coupon_discount_amount';
SHOW COLUMNS FROM orders LIKE 'membership_discount_amount';
SHOW COLUMNS FROM orders LIKE 'delivery_method';
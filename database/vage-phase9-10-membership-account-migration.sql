-- VAGE Phase 9 + 10 — Membership and customer account features
-- MySQL 8.0.46+. Additive and re-runnable. Does not alter historical order addresses.
USE vage_clothing;

CREATE TABLE IF NOT EXISTS membership_plans (
  plan_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_code VARCHAR(30) NOT NULL,
  display_name VARCHAR(60) NOT NULL,
  price_amount DECIMAL(10,2) NOT NULL,
  duration_days INT UNSIGNED NOT NULL DEFAULT 365,
  discount_percent DECIMAL(5,2) NOT NULL,
  free_shipping_minimum DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  free_shipping_methods JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (plan_id),
  UNIQUE KEY uq_membership_plans_code (plan_code),
  CONSTRAINT chk_membership_price CHECK (price_amount > 0),
  CONSTRAINT chk_membership_duration CHECK (duration_days > 0),
  CONSTRAINT chk_membership_discount CHECK (discount_percent >= 0 AND discount_percent <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Older VAGE installations may already have membership_plans because checkout
-- reads discount_percent/free_shipping_* from it. Add the purchase-display fields
-- without replacing any existing benefits or prices.
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='membership_plans' AND column_name='display_name')=0,
  'ALTER TABLE membership_plans ADD COLUMN display_name VARCHAR(60) NULL AFTER plan_code',
  'SELECT ''membership_plans.display_name already exists'' AS migration_note');
PREPARE vage_stmt FROM @ddl; EXECUTE vage_stmt; DEALLOCATE PREPARE vage_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='membership_plans' AND column_name='price_amount')=0,
  'ALTER TABLE membership_plans ADD COLUMN price_amount DECIMAL(10,2) NULL AFTER display_name',
  'SELECT ''membership_plans.price_amount already exists'' AS migration_note');
PREPARE vage_stmt FROM @ddl; EXECUTE vage_stmt; DEALLOCATE PREPARE vage_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='membership_plans' AND column_name='duration_days')=0,
  'ALTER TABLE membership_plans ADD COLUMN duration_days INT UNSIGNED NOT NULL DEFAULT 365 AFTER price_amount',
  'SELECT ''membership_plans.duration_days already exists'' AS migration_note');
PREPARE vage_stmt FROM @ddl; EXECUTE PREPARE vage_stmt; DEALLOCATE PREPARE vage_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='membership_plans' AND column_name='updated_at')=0,
  'ALTER TABLE membership_plans ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT ''membership_plans.updated_at already exists'' AS migration_note');
PREPARE vage_stmt FROM @ddl; EXECUTE vage_stmt; DEALLOCATE PREPARE vage_stmt;

-- A separate purchase record prevents membership payments from being confused
-- with product orders/payments. Razorpay webhooks can identify either entity.
CREATE TABLE IF NOT EXISTS membership_purchases (
  purchase_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  purchase_type ENUM('NEW','RENEWAL') NOT NULL DEFAULT 'NEW',
  idempotency_key VARCHAR(80) NOT NULL,
  gateway VARCHAR(20) NOT NULL DEFAULT 'RAZORPAY',
  gateway_order_id VARCHAR(80) DEFAULT NULL,
  gateway_payment_id VARCHAR(80) DEFAULT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status ENUM('CREATED','AUTHORIZED','CAPTURED','FAILED') NOT NULL DEFAULT 'CREATED',
  signature_verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  paid_at DATETIME DEFAULT NULL,
  PRIMARY KEY (purchase_id),
  UNIQUE KEY uq_membership_purchase_user_idem (user_id, idempotency_key),
  UNIQUE KEY uq_membership_purchase_gateway_order (gateway_order_id),
  UNIQUE KEY uq_membership_purchase_gateway_payment (gateway_payment_id),
  KEY idx_membership_purchase_user_date (user_id, created_at),
  KEY idx_membership_purchase_status_date (status, created_at),
  CONSTRAINT fk_membership_purchase_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_membership_purchase_plan FOREIGN KEY (plan_id) REFERENCES membership_plans(plan_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_membership_purchase_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_memberships (
  membership_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  purchase_id BIGINT UNSIGNED DEFAULT NULL,
  status ENUM('ACTIVE','EXPIRED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  starts_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  cancelled_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (membership_id),
  UNIQUE KEY uq_user_membership_purchase (purchase_id),
  KEY idx_user_membership_active (user_id, status, starts_at, expires_at),
  CONSTRAINT fk_user_membership_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_user_membership_plan FOREIGN KEY (plan_id) REFERENCES membership_plans(plan_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_user_membership_purchase FOREIGN KEY (purchase_id) REFERENCES membership_purchases(purchase_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_user_membership_dates CHECK (expires_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Backwards-compatible support for installations with a pre-existing user_memberships
-- table. The checkout code already expects status/starts_at/expires_at; this adds
-- only the purchase reference and cancellation timestamp if they are absent.
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='user_memberships' AND column_name='purchase_id')=0,
  'ALTER TABLE user_memberships ADD COLUMN purchase_id BIGINT UNSIGNED NULL',
  'SELECT ''user_memberships.purchase_id already exists'' AS migration_note');
PREPARE vage_stmt FROM @ddl; EXECUTE vage_stmt; DEALLOCATE PREPARE vage_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='user_memberships' AND column_name='cancelled_at')=0,
  'ALTER TABLE user_memberships ADD COLUMN cancelled_at DATETIME NULL',
  'SELECT ''user_memberships.cancelled_at already exists'' AS migration_note');
PREPARE vage_stmt FROM @ddl; EXECUTE vage_stmt; DEALLOCATE PREPARE vage_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='user_memberships' AND column_name='updated_at')=0,
  'ALTER TABLE user_memberships ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT ''user_memberships.updated_at already exists'' AS migration_note');
PREPARE vage_stmt FROM @ddl; EXECUTE vage_stmt; DEALLOCATE PREPARE vage_stmt;

-- Fill purchase-facing fields only when they are NULL. Existing configured prices,
-- discounts and shipping benefits are preserved.
INSERT INTO membership_plans
  (plan_code, display_name, price_amount, duration_days, discount_percent,
   free_shipping_minimum, free_shipping_methods, is_active)
VALUES
  ('basic', 'Basic', 599.00, 365, 10.00, 2000.00, JSON_ARRAY('standard','express','priority'), 1),
  ('premium', 'Premium', 1299.00, 365, 20.00, 0.00, JSON_ARRAY('standard','express','priority'), 1),
  ('vip', 'VIP', 1599.00, 365, 30.00, 0.00, JSON_ARRAY('standard','express','priority'), 1)
ON DUPLICATE KEY UPDATE
  display_name = COALESCE(display_name, VALUES(display_name)),
  price_amount = COALESCE(price_amount, VALUES(price_amount)),
  duration_days = COALESCE(duration_days, VALUES(duration_days));

-- Customer address book. Order delivery snapshots remain in the existing addresses
-- table, so editing a saved address cannot mutate a historical order.
CREATE TABLE IF NOT EXISTS saved_addresses (
  saved_address_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(40) NOT NULL DEFAULT 'Home',
  recipient_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address_line1 VARCHAR(200) NOT NULL,
  address_line2 VARCHAR(200) DEFAULT NULL,
  city VARCHAR(100) NOT NULL,
  state_name VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(80) NOT NULL DEFAULT 'India',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (saved_address_id),
  KEY idx_saved_addresses_user_default (user_id, is_default, created_at),
  CONSTRAINT fk_saved_addresses_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_saved_addresses_phone CHECK (REGEXP_LIKE(phone, '^[0-9]{10,15}$')),
  CONSTRAINT chk_saved_addresses_postal CHECK ((country <> 'India') OR REGEXP_LIKE(postal_code, '^[0-9]{6}$'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS wishlist_items (
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, product_id),
  KEY idx_wishlist_product_created (product_id, created_at),
  CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Verification
SHOW TABLES LIKE 'membership_plans';
SHOW TABLES LIKE 'membership_purchases';
SHOW TABLES LIKE 'user_memberships';
SHOW TABLES LIKE 'saved_addresses';
SHOW TABLES LIKE 'wishlist_items';
SELECT plan_code, display_name, price_amount, duration_days, discount_percent, free_shipping_minimum, is_active
FROM membership_plans ORDER BY plan_id;

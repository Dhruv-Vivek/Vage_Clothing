-- VAGE CLOTHING — Batch 6 payment support
-- Safe additive migration. Run against vage_clothing using MySQL 8.0.46+.

USE vage_clothing;

-- The payments table records the gateway, while the actual method (UPI/card/etc.)
-- can be stored separately later if desired. The captured Razorpay payment object
-- remains the source of truth for the specific method used.
SET @payment_method_type = (
  SELECT column_type
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND column_name = 'payment_method'
  LIMIT 1
);
SET @ddl = IF(
  @payment_method_type IS NOT NULL
    AND LOCATE('RAZORPAY', UPPER(@payment_method_type)) = 0,
  "ALTER TABLE payments MODIFY COLUMN payment_method ENUM('COD','UPI','CARD','NETBANKING','WALLET','RAZORPAY') NOT NULL",
  "SELECT 'payments.payment_method already supports RAZORPAY' AS migration_note"
);
PREPARE vage_payment_stmt FROM @ddl;
EXECUTE vage_payment_stmt;
DEALLOCATE PREPARE vage_payment_stmt;

-- Protects the checkout create-order endpoint from accidental double submits
-- and safe retries after transient network failures.
CREATE TABLE IF NOT EXISTS checkout_idempotency_keys (
  checkout_idempotency_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(80) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  order_id BIGINT UNSIGNED DEFAULT NULL,
  razorpay_order_id VARCHAR(80) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (checkout_idempotency_id),
  UNIQUE KEY uq_checkout_idempotency_user_key (user_id, idempotency_key),
  UNIQUE KEY uq_checkout_idempotency_order (order_id),
  KEY idx_checkout_idempotency_created (created_at),
  CONSTRAINT fk_checkout_idempotency_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_checkout_idempotency_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Verify the enum and table after executing.
SELECT column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'payments'
  AND column_name = 'payment_method';

SHOW TABLES LIKE 'checkout_idempotency_keys';

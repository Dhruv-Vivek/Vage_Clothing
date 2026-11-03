-- VAGE CLOTHING — Batch 6.1 Cashfree + local demo payment support
-- Requires the Batch 5–6 and Batch 6 migrations to have been applied first.
-- Additive and re-runnable on MySQL 8.0.46.

USE vage_clothing;

-- Payment method enum: retain legacy Razorpay values and add the new providers.
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
    AND (
      LOCATE('CASHFREE', UPPER(@payment_method_type)) = 0
      OR LOCATE('DEMO', UPPER(@payment_method_type)) = 0
    ),
  "ALTER TABLE payments MODIFY COLUMN payment_method ENUM('COD','UPI','CARD','NETBANKING','WALLET','RAZORPAY','CASHFREE','DEMO') NOT NULL",
  "SELECT 'payments.payment_method already supports CASHFREE and DEMO' AS migration_note"
);
PREPARE vage_payment_method_stmt FROM @ddl;
EXECUTE vage_payment_method_stmt;
DEALLOCATE PREPARE vage_payment_method_stmt;

-- Add PENDING to the provider-attempt lifecycle.
SET @gateway_status_type = (
  SELECT column_type
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_payment_gateways'
    AND column_name = 'status'
  LIMIT 1
);
SET @ddl = IF(
  @gateway_status_type IS NOT NULL
    AND LOCATE('PENDING', UPPER(@gateway_status_type)) = 0,
  "ALTER TABLE order_payment_gateways MODIFY COLUMN status ENUM('CREATED','PENDING','AUTHORIZED','CAPTURED','FAILED','REFUNDED') NOT NULL DEFAULT 'CREATED'",
  "SELECT 'order_payment_gateways.status already supports PENDING' AS migration_note"
);
PREPARE vage_gateway_status_stmt FROM @ddl;
EXECUTE vage_gateway_status_stmt;
DEALLOCATE PREPARE vage_gateway_status_stmt;

-- Persist Cashfree session and generic provider identifiers without removing
-- legacy razorpay_order_id data or columns.
SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'order_payment_gateways'
     AND column_name = 'payment_session_id') = 0,
  'ALTER TABLE order_payment_gateways ADD COLUMN payment_session_id VARCHAR(512) DEFAULT NULL AFTER gateway_payment_id',
  'SELECT ''order_payment_gateways.payment_session_id already exists'' AS migration_note'
);
PREPARE vage_gateway_session_stmt FROM @ddl;
EXECUTE vage_gateway_session_stmt;
DEALLOCATE PREPARE vage_gateway_session_stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'checkout_idempotency_keys'
     AND column_name = 'gateway_order_id') = 0,
  'ALTER TABLE checkout_idempotency_keys ADD COLUMN gateway_order_id VARCHAR(80) DEFAULT NULL AFTER razorpay_order_id',
  'SELECT ''checkout_idempotency_keys.gateway_order_id already exists'' AS migration_note'
);
PREPARE vage_idem_order_stmt FROM @ddl;
EXECUTE vage_idem_order_stmt;
DEALLOCATE PREPARE vage_idem_order_stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'checkout_idempotency_keys'
     AND column_name = 'payment_session_id') = 0,
  'ALTER TABLE checkout_idempotency_keys ADD COLUMN payment_session_id VARCHAR(512) DEFAULT NULL AFTER gateway_order_id',
  'SELECT ''checkout_idempotency_keys.payment_session_id already exists'' AS migration_note'
);
PREPARE vage_idem_session_stmt FROM @ddl;
EXECUTE vage_idem_session_stmt;
DEALLOCATE PREPARE vage_idem_session_stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'checkout_idempotency_keys'
     AND column_name = 'payment_provider') = 0,
  'ALTER TABLE checkout_idempotency_keys ADD COLUMN payment_provider VARCHAR(20) DEFAULT NULL AFTER payment_session_id',
  'SELECT ''checkout_idempotency_keys.payment_provider already exists'' AS migration_note'
);
PREPARE vage_idem_provider_stmt FROM @ddl;
EXECUTE vage_idem_provider_stmt;
DEALLOCATE PREPARE vage_idem_provider_stmt;

CREATE TABLE IF NOT EXISTS cashfree_webhook_events (
  cashfree_webhook_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider_event_id CHAR(64) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSON NOT NULL,
  processing_status ENUM('RECEIVED','PROCESSED','FAILED') NOT NULL DEFAULT 'RECEIVED',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(1000) DEFAULT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME DEFAULT NULL,
  PRIMARY KEY (cashfree_webhook_event_id),
  UNIQUE KEY uq_cashfree_provider_event (provider_event_id),
  KEY idx_cashfree_events_status (processing_status, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Verification
SELECT column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'payments'
  AND column_name = 'payment_method';

SELECT column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'order_payment_gateways'
  AND column_name = 'status';

SHOW COLUMNS FROM order_payment_gateways LIKE 'payment_session_id';
SHOW COLUMNS FROM checkout_idempotency_keys LIKE 'gateway_order_id';
SHOW COLUMNS FROM checkout_idempotency_keys LIKE 'payment_session_id';
SHOW COLUMNS FROM checkout_idempotency_keys LIKE 'payment_provider';
SHOW TABLES LIKE 'cashfree_webhook_events';

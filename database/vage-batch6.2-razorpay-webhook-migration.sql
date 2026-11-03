-- VAGE Batch 6.2 — Razorpay webhook event inbox
-- Safe to re-run. Also upgrades the earlier webhook table schema if present.
-- Requires the Batch 6–6.1 payment migrations.

USE vage_clothing;

CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
  razorpay_webhook_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider_event_id VARCHAR(120) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSON NOT NULL,
  processing_status ENUM('RECEIVED','PROCESSING','PROCESSED','FAILED') NOT NULL DEFAULT 'RECEIVED',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(1000) DEFAULT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  processed_at DATETIME DEFAULT NULL,
  PRIMARY KEY (razorpay_webhook_event_id),
  UNIQUE KEY uq_razorpay_provider_event (provider_event_id),
  KEY idx_razorpay_events_status (processing_status, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Older VAGE databases may already have this table with webhook_event_id.
-- Rename it only when the old column exists and the Batch 6.2 name does not.
SET @vage_has_old_webhook_id = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'razorpay_webhook_events'
    AND COLUMN_NAME = 'webhook_event_id'
);
SET @vage_has_new_webhook_id = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'razorpay_webhook_events'
    AND COLUMN_NAME = 'razorpay_webhook_event_id'
);
SET @vage_webhook_id_upgrade = IF(
  @vage_has_old_webhook_id = 1 AND @vage_has_new_webhook_id = 0,
  'ALTER TABLE razorpay_webhook_events CHANGE COLUMN webhook_event_id razorpay_webhook_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT',
  'SELECT 1'
);
PREPARE vage_webhook_id_stmt FROM @vage_webhook_id_upgrade;
EXECUTE vage_webhook_id_stmt;
DEALLOCATE PREPARE vage_webhook_id_stmt;

-- The worker uses PROCESSING to claim an event and updated_at for stale-claim recovery.
ALTER TABLE razorpay_webhook_events
  MODIFY COLUMN event_type VARCHAR(100) NOT NULL,
  MODIFY COLUMN processing_status ENUM('RECEIVED','PROCESSING','PROCESSED','FAILED') NOT NULL DEFAULT 'RECEIVED';

SET @vage_has_updated_at = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'razorpay_webhook_events'
    AND COLUMN_NAME = 'updated_at'
);
SET @vage_updated_at_upgrade = IF(
  @vage_has_updated_at = 0,
  'ALTER TABLE razorpay_webhook_events ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER received_at',
  'SELECT 1'
);
PREPARE vage_updated_at_stmt FROM @vage_updated_at_upgrade;
EXECUTE vage_updated_at_stmt;
DEALLOCATE PREPARE vage_updated_at_stmt;

-- Verify the inbox matches the worker's expected schema.
SHOW TABLES LIKE 'razorpay_webhook_events';
DESCRIBE razorpay_webhook_events;

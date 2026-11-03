-- VAGE Batch 6.2 — Razorpay webhook event inbox
-- Additive and safe to re-run. Requires the Batch 6–6.1 payment migrations.

USE vage_clothing;

CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
  razorpay_webhook_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider_event_id VARCHAR(120) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSON NOT NULL,
  processing_status ENUM('RECEIVED','PROCESSED','FAILED') NOT NULL DEFAULT 'RECEIVED',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(1000) DEFAULT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME DEFAULT NULL,
  PRIMARY KEY (razorpay_webhook_event_id),
  UNIQUE KEY uq_razorpay_provider_event (provider_event_id),
  KEY idx_razorpay_events_status (processing_status, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Verify the webhook inbox exists.
SHOW TABLES LIKE 'razorpay_webhook_events';
DESCRIBE razorpay_webhook_events;

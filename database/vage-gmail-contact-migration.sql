-- VAGE Clothing — Gmail mailbox + Contact Us message persistence
-- Requires the Batch 5–6 / Batch 6 / Batch 6.1 migrations.
-- Additive migration for MySQL 8.0.46.

USE vage_clothing;

CREATE TABLE IF NOT EXISTS contact_messages (
  contact_message_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  subject VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  notification_status ENUM('PENDING','PROCESSING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
  notification_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  notification_last_error VARCHAR(1000) DEFAULT NULL,
  notification_message_id VARCHAR(255) DEFAULT NULL,
  notification_sent_at DATETIME DEFAULT NULL,
  acknowledgement_status ENUM('PENDING','PROCESSING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
  acknowledgement_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  acknowledgement_last_error VARCHAR(1000) DEFAULT NULL,
  acknowledgement_message_id VARCHAR(255) DEFAULT NULL,
  acknowledgement_sent_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (contact_message_id),
  KEY idx_contact_messages_email_created (email, created_at),
  KEY idx_contact_notification_queue (notification_status, updated_at),
  KEY idx_contact_ack_queue (acknowledgement_status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SHOW TABLES LIKE 'contact_messages';
SHOW COLUMNS FROM contact_messages;

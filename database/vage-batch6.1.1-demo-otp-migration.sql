-- VAGE CLOTHING — Batch 6.1.1 local demo OTP sessions
-- Requires Batch 5–6, Batch 6 and Batch 6.1 migrations.
-- Additive; safe to run on MySQL 8.0.46.

USE vage_clothing;

CREATE TABLE IF NOT EXISTS demo_payment_otp_sessions (
  demo_payment_otp_session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  otp_salt CHAR(32) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  payment_method ENUM('UPI','CARD','NETBANKING','WALLET') NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('ACTIVE','CONSUMED','EXPIRED','LOCKED') NOT NULL DEFAULT 'ACTIVE',
  expires_at DATETIME NOT NULL,
  verified_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (demo_payment_otp_session_id),
  UNIQUE KEY uq_demo_payment_otp_token (token_hash),
  KEY idx_demo_payment_otp_order (order_id, user_id, status),
  KEY idx_demo_payment_otp_expiry (status, expires_at),
  CONSTRAINT fk_demo_payment_otp_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_demo_payment_otp_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SHOW TABLES LIKE 'demo_payment_otp_sessions';
SHOW COLUMNS FROM demo_payment_otp_sessions;

-- VAGE payment gateway references for Razorpay, Cashfree and demo checkout.
-- Additive. Run before vage-batch6.1-cashfree-demo-migration.sql on a fresh database.
USE vage_clothing;

CREATE TABLE IF NOT EXISTS order_payment_gateways (
  order_payment_gateway_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_id BIGINT UNSIGNED NOT NULL,
  gateway ENUM('RAZORPAY','CASHFREE','DEMO') NOT NULL,
  gateway_order_id VARCHAR(120) NOT NULL,
  gateway_payment_id VARCHAR(120) DEFAULT NULL,
  payment_session_id VARCHAR(512) DEFAULT NULL,
  status ENUM('CREATED','PENDING','AUTHORIZED','CAPTURED','FAILED','REFUNDED') NOT NULL DEFAULT 'CREATED',
  signature_verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_payment_gateway_id),
  UNIQUE KEY uq_order_payment_gateway_payment (payment_id),
  UNIQUE KEY uq_order_payment_gateway_order (gateway_order_id),
  UNIQUE KEY uq_order_payment_gateway_payment_ref (gateway_payment_id),
  KEY idx_order_payment_gateway_status (gateway, status, updated_at),
  CONSTRAINT fk_order_payment_gateway_payment
    FOREIGN KEY (payment_id) REFERENCES payments(payment_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SHOW COLUMNS FROM order_payment_gateways;
SHOW INDEX FROM order_payment_gateways;
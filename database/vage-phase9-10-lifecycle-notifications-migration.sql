-- VAGE lifecycle notifications and refund references. MySQL 8.0+, additive and re-runnable.
USE vage_clothing;

SET @has_enum_event_type = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'email_outbox'
     AND column_name = 'event_type' AND data_type = 'enum'
);
SET @event_type_ddl = IF(
  @has_enum_event_type = 1,
  'ALTER TABLE email_outbox MODIFY COLUMN event_type VARCHAR(64) NOT NULL',
  'SELECT 1'
);
PREPARE vage_event_type_stmt FROM @event_type_ddl;
EXECUTE vage_event_type_stmt;
DEALLOCATE PREPARE vage_event_type_stmt;

SET @has_refund_amount = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'returns' AND column_name = 'refund_amount'
);
SET @refund_amount_ddl = IF(
  @has_refund_amount = 0,
  'ALTER TABLE returns ADD COLUMN refund_amount DECIMAL(12,2) NULL AFTER resolution_notes',
  'SELECT 1'
);
PREPARE vage_refund_amount_stmt FROM @refund_amount_ddl;
EXECUTE vage_refund_amount_stmt;
DEALLOCATE PREPARE vage_refund_amount_stmt;

SET @has_refund_reference = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'returns' AND column_name = 'refund_reference'
);
SET @refund_reference_ddl = IF(
  @has_refund_reference = 0,
  'ALTER TABLE returns ADD COLUMN refund_reference VARCHAR(120) NULL AFTER refund_amount',
  'SELECT 1'
);
PREPARE vage_refund_reference_stmt FROM @refund_reference_ddl;
EXECUTE vage_refund_reference_stmt;
DEALLOCATE PREPARE vage_refund_reference_stmt;

SHOW COLUMNS FROM email_outbox LIKE 'event_type';
SHOW COLUMNS FROM returns LIKE 'refund_amount';
SHOW COLUMNS FROM returns LIKE 'refund_reference';

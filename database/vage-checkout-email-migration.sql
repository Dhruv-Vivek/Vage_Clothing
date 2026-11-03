USE vage_clothing;

-- Store the email address supplied at checkout for this specific order.
-- Existing orders keep NULL and continue using the account email as a fallback.
SET @vage_contact_email_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'contact_email'
);

SET @vage_contact_email_ddl := IF(
  @vage_contact_email_exists = 0,
  'ALTER TABLE orders ADD COLUMN contact_email VARCHAR(190) NULL AFTER user_id',
  'SELECT ''orders.contact_email already exists'' AS migration_status'
);

PREPARE vage_contact_email_stmt FROM @vage_contact_email_ddl;
EXECUTE vage_contact_email_stmt;
DEALLOCATE PREPARE vage_contact_email_stmt;

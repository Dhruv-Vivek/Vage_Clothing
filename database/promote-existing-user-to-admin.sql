-- VAGE Clothing — promote an existing active customer account to ADMIN.
-- Run only in your own local/development database.
-- First inspect the accounts and replace the email below with your own login email.

USE vage_clothing;

SELECT user_id, full_name, email, role, is_active
FROM users
WHERE is_active = 1
ORDER BY created_at DESC;

SET @admin_email = 'replace_with_your_existing_login_email@example.com';

-- Promote only the selected active account. Password and password_hash are unchanged.
UPDATE users
SET role = 'ADMIN'
WHERE email = LOWER(TRIM(@admin_email))
  AND is_active = 1;

-- Confirm exactly which account now has admin privileges.
SELECT user_id, full_name, email, role, is_active
FROM users
WHERE email = LOWER(TRIM(@admin_email))
LIMIT 1;

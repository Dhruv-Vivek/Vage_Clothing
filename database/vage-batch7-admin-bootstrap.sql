USE vage_clothing;

-- VAGE Batch 7: promote an existing active account to ADMIN.
-- Replace the example address with the email of the account you control.
-- This does not create accounts or change passwords.
UPDATE users
SET role = 'ADMIN'
WHERE email = 'replace-with-your-admin-email@example.com'
  AND is_active = 1
  AND role <> 'ADMIN';

-- Verify the account was promoted. Expected: one row with role = ADMIN and is_active = 1.
SELECT user_id, full_name, email, role, is_active
FROM users
WHERE email = 'replace-with-your-admin-email@example.com'
LIMIT 1;
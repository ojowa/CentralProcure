-- Migration 120: Add security_stamp to internal_users and vendors
-- The security-stamp middleware validates JWTs against this column.
-- On password change the stamp rotates, invalidating all other sessions.

ALTER TABLE identity.internal_users ADD COLUMN IF NOT EXISTS security_stamp uuid DEFAULT gen_random_uuid();
ALTER TABLE identity.vendors ADD COLUMN IF NOT EXISTS security_stamp uuid DEFAULT gen_random_uuid();

-- Ensure every existing row has a stamp (DEFAULT only applies to new inserts)
UPDATE identity.internal_users SET security_stamp = gen_random_uuid() WHERE security_stamp IS NULL;
UPDATE identity.vendors SET security_stamp = gen_random_uuid() WHERE security_stamp IS NULL;

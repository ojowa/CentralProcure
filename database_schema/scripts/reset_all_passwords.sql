-- Reset All User Passwords to Default (Password123)
-- WARNING: This will reset ALL user passwords in both internal_users and vendors tables.
-- Run with caution and ensure you have backups.
-- Audit entries are logged to identity.password_audit for internal users.

BEGIN;

-- New BCrypt hash for 'Password123'
DO $$
DECLARE
    v_new_password_hash TEXT := '$2a$11$0UVaqoyv2mYnLMwoQx/.se1KQwBDIF/tj8KJunB7gYGJxWf.V07Ai';
    v_admin_user_id UUID;
    v_affected_internal_users INTEGER;
    v_affected_vendors INTEGER;
BEGIN
    -- Get admin user ID for audit trail
    SELECT internal_user_id INTO v_admin_user_id
    FROM identity.internal_users
    WHERE email = 'admin@nis.gov.ng';

    IF v_admin_user_id IS NULL THEN
        RAISE WARNING 'Admin user not found. Audit entries will have NULL changed_by.';
    END IF;

    -- Reset all internal user passwords
    UPDATE identity.internal_users
    SET password_hash = v_new_password_hash,
        updated_at = NOW(),
        updated_by = 'system_password_reset';

    GET DIAGNOSTICS v_affected_internal_users = ROW_COUNT;
    RAISE NOTICE 'Reset passwords for % internal users', v_affected_internal_users;

    -- Create audit entries for each internal user reset
    INSERT INTO identity.password_audit (internal_user_id, action, changed_by, created_at)
    SELECT 
        internal_user_id,
        'admin_reset',
        v_admin_user_id,
        NOW()
    FROM identity.internal_users;

    RAISE NOTICE 'Created % audit entries for internal user password resets', v_affected_internal_users;

    -- Reset all vendor passwords
    UPDATE identity.vendors
    SET password_hash = v_new_password_hash,
        updated_at = NOW(),
        updated_by = 'system_password_reset';

    GET DIAGNOSTICS v_affected_vendors = ROW_COUNT;
    RAISE NOTICE 'Reset passwords for % vendors', v_affected_vendors;

    RAISE NOTICE 'Password reset complete. All users can now log in with password: Password123';
END;
$$;

COMMIT;

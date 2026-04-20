-- Migration 095: Audit trail for user role changes and session protection
BEGIN;

-- 1. Create User Role Audit Table
CREATE TABLE IF NOT EXISTS identity.user_role_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_internal_user_id UUID NOT NULL REFERENCES identity.internal_users(internal_user_id) ON DELETE CASCADE,
    previous_role_id UUID NULL REFERENCES identity.roles(role_id) ON DELETE SET NULL,
    new_role_id UUID NOT NULL REFERENCES identity.roles(role_id) ON DELETE CASCADE,
    changed_by_user_id UUID NULL REFERENCES identity.internal_users(internal_user_id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_reason TEXT NULL
);

CREATE INDEX IF NOT EXISTS ix_user_role_audit_target 
    ON identity.user_role_audit (target_internal_user_id);

CREATE INDEX IF NOT EXISTS ix_user_role_audit_changed_at 
    ON identity.user_role_audit (changed_at DESC);

-- 2. Update Role Assignment Logic with Audit Logging and Self-Change Protection
CREATE OR REPLACE FUNCTION identity.update_internal_user_role(
    p_internal_user_id UUID,
    p_role_name VARCHAR(100),
    p_changed_by_user_id UUID
)
RETURNS TABLE (
    internal_user_id UUID,
    email VARCHAR(255),
    role VARCHAR(100)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_role_id UUID;
    v_new_role_id UUID;
BEGIN
    -- Self-change protection: Prevent an admin from demoting themselves and losing access
    -- This is a safety measure to prevent locking the system if only one admin exists.
    IF p_internal_user_id = p_changed_by_user_id THEN
        RAISE EXCEPTION 'Self-role modification is restricted to prevent administrative lockout.';
    END IF;

    -- Resolve the new role ID
    SELECT r.role_id
    INTO v_new_role_id
    FROM identity.roles r
    WHERE LOWER(REGEXP_REPLACE(r.role_name, '[^a-zA-Z0-9]+', '', 'g')) =
          LOWER(REGEXP_REPLACE(p_role_name, '[^a-zA-Z0-9]+', '', 'g'))
      AND r.is_active = TRUE;

    IF v_new_role_id IS NULL THEN
        RAISE EXCEPTION 'Role not found or inactive';
    END IF;

    -- Capture the current (old) role ID for audit
    SELECT role_id INTO v_old_role_id 
    FROM identity.internal_users 
    WHERE internal_user_id = p_internal_user_id;

    -- Perform the update
    UPDATE identity.internal_users AS iu
    SET role_id = v_new_role_id,
        updated_at = NOW()
    WHERE iu.internal_user_id = p_internal_user_id;

    -- Record the change in the audit trail
    INSERT INTO identity.user_role_audit (
        target_internal_user_id,
        previous_role_id,
        new_role_id,
        changed_by_user_id,
        change_reason
    )
    VALUES (
        p_internal_user_id,
        v_old_role_id,
        v_new_role_id,
        p_changed_by_user_id,
        'Role updated via Administration module.'
    );

    RETURN QUERY
    SELECT
        iu.internal_user_id,
        iu.email,
        r.role_name AS role
    FROM identity.internal_users AS iu
    JOIN identity.roles AS r ON r.role_id = iu.role_id
    WHERE iu.internal_user_id = p_internal_user_id;
END;
$$;

-- 3. Update the Stored Procedure Wrapper
CREATE OR REPLACE PROCEDURE identity.update_internal_user_role_sp(
    IN p_internal_user_id UUID,
    IN p_role_name VARCHAR(100),
    IN p_changed_by_user_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.update_internal_user_role(p_internal_user_id, p_role_name, p_changed_by_user_id);
END;
$$;

COMMIT;

-- Migration 098: Role scheduling and automatic expiration
BEGIN;

-- 1. Add scheduling columns to internal_users
ALTER TABLE identity.internal_users 
ADD COLUMN IF NOT EXISTS role_effective_from TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS role_expires_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS backup_role_id UUID NULL REFERENCES identity.roles(role_id) ON DELETE SET NULL;

-- 2. Create a function to reconcile expired roles
-- This can be called during login or via a scheduled job
CREATE OR REPLACE FUNCTION identity.reconcile_user_role(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_current_role_id UUID;
    v_backup_role_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    SELECT role_id, backup_role_id, role_expires_at 
    INTO v_current_role_id, v_backup_role_id, v_expires_at
    FROM identity.internal_users
    WHERE internal_user_id = p_user_id;

    -- If the current role has expired and a backup exists, revert to backup
    IF v_expires_at IS NOT NULL AND v_expires_at < NOW() AND v_backup_role_id IS NOT NULL THEN
        UPDATE identity.internal_users
        SET role_id = v_backup_role_id,
            backup_role_id = NULL,
            role_expires_at = NULL,
            role_effective_from = NULL,
            security_stamp = (gen_random_uuid())::text, -- Invalidate current session
            updated_at = NOW()
        WHERE internal_user_id = p_user_id;

        -- Audit the automatic reversion
        INSERT INTO identity.user_role_audit (
            target_internal_user_id,
            previous_role_id,
            new_role_id,
            changed_by_user_id,
            change_reason
        )
        VALUES (
            p_user_id,
            v_current_role_id,
            v_backup_role_id,
            NULL, -- System automated
            'Automatic role reversion upon expiration of temporary assignment.'
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Update internal_login to include reconciliation and new fields
CREATE OR REPLACE FUNCTION identity.internal_login(
    p_email VARCHAR(255),
    p_password_hash VARCHAR(255)
)
RETURNS TABLE (
    internal_user_id UUID,
    email VARCHAR(255),
    role VARCHAR(100),
    status VARCHAR(50),
    security_stamp VARCHAR(36),
    error_message TEXT
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    v_internal_user_id UUID;
    v_current_password_hash VARCHAR(255);
    v_role_name VARCHAR(100);
    v_status VARCHAR(50);
    v_security_stamp VARCHAR(36);
    v_lockout_until TIMESTAMP WITHOUT TIME ZONE;
    v_failed_attempts INT;
BEGIN
    -- Resolve user ID first for reconciliation
    SELECT iu.internal_user_id INTO v_internal_user_id
    FROM identity.internal_users iu
    WHERE iu.email = p_email;

    -- Run reconciliation if user exists
    IF v_internal_user_id IS NOT NULL THEN
        PERFORM identity.reconcile_user_role(v_internal_user_id);
    END IF;

    -- Standard login logic
    SELECT
        iu.internal_user_id,
        iu.password_hash,
        r.role_name,
        iu.status,
        iu.security_stamp,
        uls.lockout_until,
        COALESCE(uls.failed_login_attempts, 0)
    INTO
        v_internal_user_id,
        v_current_password_hash,
        v_role_name,
        v_status,
        v_security_stamp,
        v_lockout_until,
        v_failed_attempts
    FROM
        identity.internal_users iu
        JOIN identity.roles r ON r.role_id = iu.role_id
        LEFT JOIN identity.user_login_security uls ON uls.internal_user_id = iu.internal_user_id
    WHERE
        iu.email = p_email;

    IF v_internal_user_id IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Invalid credentials'::TEXT;
        RETURN;
    END IF;

    IF v_lockout_until IS NOT NULL AND v_lockout_until > NOW() THEN
        RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Account is temporarily locked. Please try again later.'::TEXT;
        RETURN;
    END IF;

    IF v_current_password_hash = p_password_hash THEN
        IF v_status = 'Active' THEN
            -- Check if role is not yet effective
            DECLARE
                v_effective_from TIMESTAMPTZ;
            BEGIN
                SELECT role_effective_from INTO v_effective_from FROM identity.internal_users WHERE internal_user_id = v_internal_user_id;
                IF v_effective_from IS NOT NULL AND v_effective_from > NOW() THEN
                     RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Your assigned role is not yet active. Start date: ' || v_effective_from::text;
                     RETURN;
                END IF;
            END;

            INSERT INTO identity.user_login_security (internal_user_id, failed_login_attempts, lockout_until, updated_at)
            VALUES (v_internal_user_id, 0, NULL, NOW())
            ON CONFLICT (internal_user_id) DO UPDATE
            SET failed_login_attempts = 0,
                lockout_until = NULL,
                updated_at = NOW();

            UPDATE identity.internal_users
            SET last_login = NOW(),
                updated_at = NOW()
            WHERE internal_user_id = v_internal_user_id;

            RETURN QUERY
            SELECT
                iu.internal_user_id,
                iu.email,
                r.role_name AS role,
                iu.status,
                iu.security_stamp,
                NULL::TEXT AS error_message
            FROM
                identity.internal_users iu
                JOIN identity.roles r ON r.role_id = iu.role_id
            WHERE
                iu.internal_user_id = v_internal_user_id;
        ELSE
            RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Account not active'::TEXT;
        END IF;
    ELSE
        v_failed_attempts := v_failed_attempts + 1;
        IF v_failed_attempts >= 5 THEN v_lockout_until := NOW() + INTERVAL '15 minutes'; ELSE v_lockout_until := NULL; END IF;

        INSERT INTO identity.user_login_security (internal_user_id, failed_login_attempts, lockout_until, updated_at)
        VALUES (v_internal_user_id, v_failed_attempts, v_lockout_until, NOW())
        ON CONFLICT (internal_user_id) DO UPDATE
        SET failed_login_attempts = v_failed_attempts,
            lockout_until = v_lockout_until,
            updated_at = NOW();

        IF v_failed_attempts >= 5 THEN
            RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Account locked due to too many failed attempts. Try again in 15 minutes.'::TEXT;
        ELSE
            RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Invalid credentials'::TEXT;
        END IF;
    END IF;
END;
$$;

-- 4. Update update_internal_user_role to support scheduling
CREATE OR REPLACE FUNCTION identity.update_internal_user_role(
    p_internal_user_id UUID,
    p_role_name VARCHAR(100),
    p_changed_by_user_id UUID,
    p_effective_from TIMESTAMPTZ DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_backup_role_name VARCHAR(100) DEFAULT NULL
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
    v_backup_role_id UUID;
    v_new_stamp VARCHAR(36);
BEGIN
    IF p_internal_user_id = p_changed_by_user_id THEN
        RAISE EXCEPTION 'Self-role modification is restricted to prevent administrative lockout.';
    END IF;

    -- Resolve the new role ID
    SELECT r.role_id INTO v_new_role_id
    FROM identity.roles r
    WHERE LOWER(REGEXP_REPLACE(r.role_name, '[^a-zA-Z0-9]+', '', 'g')) =
          LOWER(REGEXP_REPLACE(p_role_name, '[^a-zA-Z0-9]+', '', 'g'))
      AND r.is_active = TRUE;

    IF v_new_role_id IS NULL THEN
        RAISE EXCEPTION 'Target role not found or inactive';
    END IF;

    -- Resolve backup role if provided
    IF p_backup_role_name IS NOT NULL THEN
        SELECT r.role_id INTO v_backup_role_id
        FROM identity.roles r
        WHERE LOWER(REGEXP_REPLACE(r.role_name, '[^a-zA-Z0-9]+', '', 'g')) =
              LOWER(REGEXP_REPLACE(p_backup_role_name, '[^a-zA-Z0-9]+', '', 'g'))
          AND r.is_active = TRUE;
    END IF;

    -- Capture the current (old) role ID for audit
    SELECT role_id INTO v_old_role_id 
    FROM identity.internal_users 
    WHERE internal_user_id = p_internal_user_id;

    v_new_stamp := (gen_random_uuid())::text;

    -- Perform the update
    UPDATE identity.internal_users AS iu
    SET role_id = v_new_role_id,
        backup_role_id = v_backup_role_id,
        role_effective_from = p_effective_from,
        role_expires_at = p_expires_at,
        security_stamp = v_new_stamp,
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
        'Role updated with scheduling configuration. Effective: ' || COALESCE(p_effective_from::text, 'Now') || ', Expires: ' || COALESCE(p_expires_at::text, 'Never')
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

-- 5. Update the Stored Procedure Wrapper
CREATE OR REPLACE PROCEDURE identity.update_internal_user_role_sp(
    IN p_internal_user_id UUID,
    IN p_role_name VARCHAR(100),
    IN p_changed_by_user_id UUID,
    IN p_effective_from TIMESTAMPTZ,
    IN p_expires_at TIMESTAMPTZ,
    IN p_backup_role_name VARCHAR(100),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.update_internal_user_role(
        p_internal_user_id, 
        p_role_name, 
        p_changed_by_user_id,
        p_effective_from,
        p_expires_at,
        p_backup_role_name
    );
END;
$$;

COMMIT;

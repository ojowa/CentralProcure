-- Migration 096: Add security stamp for real-time session invalidation
BEGIN;

-- 1. Add security_stamp to internal_users
-- This stamp is included in the JWT and checked against the DB on every request.
-- If they don't match (e.g. after a role change), the session is invalidated.
ALTER TABLE identity.internal_users 
ADD COLUMN IF NOT EXISTS security_stamp VARCHAR(36) NOT NULL DEFAULT (gen_random_uuid())::text;

-- 2. Update existing functions to include security_stamp in results
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

-- 3. Update update_internal_user_role to refresh the security_stamp
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
    v_new_stamp VARCHAR(36);
BEGIN
    IF p_internal_user_id = p_changed_by_user_id THEN
        RAISE EXCEPTION 'Self-role modification is restricted to prevent administrative lockout.';
    END IF;

    SELECT r.role_id INTO v_new_role_id
    FROM identity.roles r
    WHERE LOWER(REGEXP_REPLACE(r.role_name, '[^a-zA-Z0-9]+', '', 'g')) =
          LOWER(REGEXP_REPLACE(p_role_name, '[^a-zA-Z0-9]+', '', 'g'))
      AND r.is_active = TRUE;

    IF v_new_role_id IS NULL THEN
        RAISE EXCEPTION 'Role not found or inactive';
    END IF;

    SELECT role_id INTO v_old_role_id 
    FROM identity.internal_users 
    WHERE internal_user_id = p_internal_user_id;

    v_new_stamp := (gen_random_uuid())::text;

    UPDATE identity.internal_users AS iu
    SET role_id = v_new_role_id,
        security_stamp = v_new_stamp,
        updated_at = NOW()
    WHERE iu.internal_user_id = p_internal_user_id;

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
        'Role updated. Session stamp refreshed to ' || v_new_stamp
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

COMMIT;

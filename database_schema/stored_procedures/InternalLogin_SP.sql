-- Function for Internal User Login (PostgreSQL)
-- Handles brute-force protection using user_login_security table.
CREATE OR REPLACE FUNCTION identity.internal_login(
    p_email VARCHAR(255),
    p_password_hash VARCHAR(255)
)
RETURNS TABLE (
    internal_user_id UUID,
    email VARCHAR(255),
    role VARCHAR(100),
    status VARCHAR(50),
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
    v_lockout_until TIMESTAMP WITHOUT TIME ZONE;
    v_failed_attempts INT;
BEGIN
    -- Get user and security info
    SELECT
        iu.internal_user_id,
        iu.password_hash,
        r.role_name,
        iu.status,
        uls.lockout_until,
        COALESCE(uls.failed_login_attempts, 0)
    INTO
        v_internal_user_id,
        v_current_password_hash,
        v_role_name,
        v_status,
        v_lockout_until,
        v_failed_attempts
    FROM
        identity.internal_users iu
        JOIN identity.roles r ON r.role_id = iu.role_id
        LEFT JOIN identity.user_login_security uls ON uls.internal_user_id = iu.internal_user_id
    WHERE
        iu.email = p_email;

    -- Check if user exists
    IF v_internal_user_id IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Invalid credentials'::TEXT;
        RETURN;
    END IF;

    -- Check for lockout
    IF v_lockout_until IS NOT NULL AND v_lockout_until > NOW() THEN
        RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Account is temporarily locked. Please try again later.'::TEXT;
        RETURN;
    END IF;

    IF v_current_password_hash = p_password_hash THEN
        IF v_status = 'Active' THEN
            -- Success: Reset security table
            INSERT INTO identity.user_login_security (internal_user_id, failed_login_attempts, lockout_until, updated_at)
            VALUES (v_internal_user_id, 0, NULL, NOW())
            ON CONFLICT (internal_user_id) DO UPDATE
            SET failed_login_attempts = 0,
                lockout_until = NULL,
                updated_at = NOW();

            -- Update last_login
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
                NULL::TEXT AS error_message
            FROM
                identity.internal_users iu
                JOIN identity.roles r ON r.role_id = iu.role_id
            WHERE
                iu.internal_user_id = v_internal_user_id;
        ELSE
            RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Account not active'::TEXT;
        END IF;
    ELSE
        -- Failure: Increment attempts and set lockout if threshold reached
        v_failed_attempts := v_failed_attempts + 1;
        
        IF v_failed_attempts >= 5 THEN
            v_lockout_until := NOW() + INTERVAL '15 minutes';
        ELSE
            v_lockout_until := NULL;
        END IF;

        INSERT INTO identity.user_login_security (internal_user_id, failed_login_attempts, lockout_until, updated_at)
        VALUES (v_internal_user_id, v_failed_attempts, v_lockout_until, NOW())
        ON CONFLICT (internal_user_id) DO UPDATE
        SET failed_login_attempts = v_failed_attempts,
            lockout_until = v_lockout_until,
            updated_at = NOW();

        IF v_failed_attempts >= 5 THEN
            RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Account locked due to too many failed attempts. Try again in 15 minutes.'::TEXT;
        ELSE
            RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Invalid credentials'::TEXT;
        END IF;
    END IF;
END;
$$;

-- Procedure wrapper for internal_login (PostgreSQL)
CREATE OR REPLACE PROCEDURE identity.internal_login_sp(
    IN p_email VARCHAR(255),
    IN p_password_hash VARCHAR(255),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.internal_login(
        p_email,
        p_password_hash
    );
END;
$$;

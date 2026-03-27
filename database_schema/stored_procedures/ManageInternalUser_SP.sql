-- Function for Updating an Internal User (PostgreSQL)
CREATE OR REPLACE FUNCTION identity.update_internal_user(
    p_internal_user_id UUID,
    p_email VARCHAR(255),
    p_username VARCHAR(100),
    p_first_name VARCHAR(100),
    p_middle_name VARCHAR(100),
    p_surname VARCHAR(100),
    p_service_number VARCHAR(100),
    p_unit_id UUID,
    p_is_active BOOLEAN
)
RETURNS TABLE (
    internal_user_id UUID,
    email VARCHAR(255),
    username VARCHAR(100),
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    surname VARCHAR(100),
    service_number VARCHAR(100),
    unit_id UUID,
    unit_name VARCHAR(255),
    role_name VARCHAR(100),
    status VARCHAR(50),
    last_login TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE identity.internal_users AS iu
    SET email = p_email,
        username = p_username,
        first_name = p_first_name,
        middle_name = NULLIF(p_middle_name, ''),
        surname = p_surname,
        service_number = p_service_number,
        unit_id = p_unit_id,
        is_active = p_is_active,
        status = CASE WHEN p_is_active THEN 'Active' ELSE 'Inactive' END,
        updated_at = NOW()
    WHERE iu.internal_user_id = p_internal_user_id;

    RETURN QUERY
    SELECT
        iu.internal_user_id,
        iu.email,
        iu.username,
        iu.first_name,
        iu.middle_name,
        iu.surname,
        iu.service_number,
        iu.unit_id,
        ou.unit_name,
        r.role_name,
        iu.status,
        iu.last_login,
        iu.created_at
    FROM identity.internal_users iu
    JOIN identity.roles r ON r.role_id = iu.role_id
    LEFT JOIN identity.organizational_units ou ON ou.unit_id = iu.unit_id
    WHERE iu.internal_user_id = p_internal_user_id;
END;
$$;

-- Procedure wrapper for update_internal_user
CREATE OR REPLACE PROCEDURE identity.update_internal_user_sp(
    IN p_internal_user_id UUID,
    IN p_email VARCHAR(255),
    IN p_username VARCHAR(100),
    IN p_first_name VARCHAR(100),
    IN p_middle_name VARCHAR(100),
    IN p_surname VARCHAR(100),
    IN p_service_number VARCHAR(100),
    IN p_unit_id UUID,
    IN p_is_active BOOLEAN,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.update_internal_user(
        p_internal_user_id,
        p_email,
        p_username,
        p_first_name,
        p_middle_name,
        p_surname,
        p_service_number,
        p_unit_id,
        p_is_active
    );
END;
$$;

-- Function for Admin Password Reset (PostgreSQL)
CREATE OR REPLACE FUNCTION identity.admin_reset_password(
    p_internal_user_id UUID,
    p_new_password_hash VARCHAR(255),
    p_reset_by UUID,
    p_require_change BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE identity.internal_users
    SET password_hash = p_new_password_hash,
        updated_at = NOW()
    WHERE internal_user_id = p_internal_user_id;

    INSERT INTO identity.password_audit (
        internal_user_id,
        action,
        changed_by
    ) VALUES (
        p_internal_user_id,
        'admin_reset',
        p_reset_by
    );
END;
$$;

-- Procedure wrapper for admin_reset_password
CREATE OR REPLACE PROCEDURE identity.admin_reset_password_sp(
    IN p_internal_user_id UUID,
    IN p_new_password_hash VARCHAR(255),
    IN p_reset_by UUID,
    IN p_require_change BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM identity.admin_reset_password(
        p_internal_user_id,
        p_new_password_hash,
        p_reset_by,
        p_require_change
    );
END;
$$;

-- Function for Updating User Status (PostgreSQL)
CREATE OR REPLACE FUNCTION identity.update_internal_user_status(
    p_internal_user_id UUID,
    p_status VARCHAR(50),
    p_is_active BOOLEAN
)
RETURNS TABLE (
    internal_user_id UUID,
    email VARCHAR(255),
    username VARCHAR(100),
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    surname VARCHAR(100),
    service_number VARCHAR(100),
    unit_id UUID,
    unit_name VARCHAR(255),
    role_name VARCHAR(100),
    status VARCHAR(50),
    last_login TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE identity.internal_users
    SET status = p_status,
        is_active = p_is_active,
        updated_at = NOW()
    WHERE internal_user_id = p_internal_user_id;

    RETURN QUERY
    SELECT
        iu.internal_user_id,
        iu.email,
        iu.username,
        iu.first_name,
        iu.middle_name,
        iu.surname,
        iu.service_number,
        iu.unit_id,
        ou.unit_name,
        r.role_name,
        iu.status,
        iu.last_login,
        iu.created_at
    FROM identity.internal_users iu
    JOIN identity.roles r ON r.role_id = iu.role_id
    LEFT JOIN identity.organizational_units ou ON ou.unit_id = iu.unit_id
    WHERE iu.internal_user_id = p_internal_user_id;
END;
$$;

-- Procedure wrapper for update_internal_user_status
CREATE OR REPLACE PROCEDURE identity.update_internal_user_status_sp(
    IN p_internal_user_id UUID,
    IN p_status VARCHAR(50),
    IN p_is_active BOOLEAN,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.update_internal_user_status(
        p_internal_user_id,
        p_status,
        p_is_active
    );
END;
$$;

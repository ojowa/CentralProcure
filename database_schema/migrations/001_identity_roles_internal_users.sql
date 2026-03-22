-- Migration 001: Roles + InternalUsers + Role Procedures (PostgreSQL)
BEGIN;

CREATE SCHEMA IF NOT EXISTS identity;

-- Roles table
CREATE TABLE IF NOT EXISTS identity.roles (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    -- Audit fields
    created_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- InternalUsers table
CREATE TABLE IF NOT EXISTS identity.internal_users (
    internal_user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    surname VARCHAR(100) NOT NULL,
    service_number VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id UUID NOT NULL REFERENCES identity.roles(role_id),
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    last_login TIMESTAMP WITHOUT TIME ZONE NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    -- Audit fields
    created_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- create_role function
CREATE OR REPLACE FUNCTION identity.create_role(
    p_role_name VARCHAR(100),
    p_description TEXT
)
RETURNS TABLE (
    role_id UUID,
    role_name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO identity.roles (role_name, description)
    VALUES (p_role_name, p_description)
    RETURNING roles.role_id, roles.role_name, roles.description, roles.is_active;
END;
$$;

-- create_role stored procedure
CREATE OR REPLACE PROCEDURE identity.create_role_sp(
    IN p_role_name VARCHAR(100),
    IN p_description TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.create_role(p_role_name, p_description);
END;
$$;

-- get_roles function
CREATE OR REPLACE FUNCTION identity.get_roles()
RETURNS TABLE (
    role_id UUID,
    role_name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.role_id,
        r.role_name,
        r.description,
        r.is_active
    FROM
        identity.roles r
    ORDER BY
        r.role_name ASC;
END;
$$;

-- get_roles stored procedure
CREATE OR REPLACE PROCEDURE identity.get_roles_sp(
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.get_roles();
END;
$$;

-- update_role function
CREATE OR REPLACE FUNCTION identity.update_role(
    p_role_id UUID,
    p_role_name VARCHAR(100),
    p_description TEXT,
    p_is_active BOOLEAN
)
RETURNS TABLE (
    role_id UUID,
    role_name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_role_name IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM identity.roles WHERE role_name = p_role_name AND role_id <> p_role_id) THEN
            RAISE EXCEPTION 'Role name already exists';
        END IF;
    END IF;

    UPDATE identity.roles
    SET
        role_name = COALESCE(p_role_name, role_name),
        description = COALESCE(p_description, description),
        is_active = COALESCE(p_is_active, is_active),
        updated_at = NOW()
    WHERE role_id = p_role_id;

    RETURN QUERY
    SELECT roles.role_id, roles.role_name, roles.description, roles.is_active
    FROM identity.roles
    WHERE roles.role_id = p_role_id;
END;
$$;

-- update_role stored procedure
CREATE OR REPLACE PROCEDURE identity.update_role_sp(
    IN p_role_id UUID,
    IN p_role_name VARCHAR(100),
    IN p_description TEXT,
    IN p_is_active BOOLEAN,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.update_role(p_role_id, p_role_name, p_description, p_is_active);
END;
$$;

-- deactivate_role function
CREATE OR REPLACE FUNCTION identity.deactivate_role(
    p_role_id UUID
)
RETURNS TABLE (
    role_id UUID,
    role_name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE identity.roles
    SET
        is_active = FALSE,
        updated_at = NOW()
    WHERE role_id = p_role_id;

    RETURN QUERY
    SELECT roles.role_id, roles.role_name, roles.description, roles.is_active
    FROM identity.roles
    WHERE roles.role_id = p_role_id;
END;
$$;

-- deactivate_role stored procedure
CREATE OR REPLACE PROCEDURE identity.deactivate_role_sp(
    IN p_role_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.deactivate_role(p_role_id);
END;
$$;

-- delete_role function
CREATE OR REPLACE FUNCTION identity.delete_role(
    p_role_id UUID
)
RETURNS TABLE (
    role_id UUID,
    role_name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM identity.internal_users WHERE role_id = p_role_id) THEN
        RAISE EXCEPTION 'Role is in use and cannot be deleted';
    END IF;

    RETURN QUERY
    DELETE FROM identity.roles
    WHERE role_id = p_role_id
    RETURNING roles.role_id, roles.role_name, roles.description, roles.is_active;
END;
$$;

-- delete_role stored procedure
CREATE OR REPLACE PROCEDURE identity.delete_role_sp(
    IN p_role_id UUID,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.delete_role(p_role_id);
END;
$$;

-- register_internal_user function
CREATE OR REPLACE FUNCTION identity.register_internal_user(
    p_email VARCHAR(255),
    p_username VARCHAR(100),
    p_first_name VARCHAR(100),
    p_middle_name VARCHAR(100),
    p_surname VARCHAR(100),
    p_service_number VARCHAR(100),
    p_password_hash VARCHAR(255),
    p_role_name VARCHAR(100)
)
RETURNS TABLE (
    internal_user_id UUID,
    email VARCHAR(255),
    role VARCHAR(100)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_role_id UUID;
    v_internal_user_id UUID;
BEGIN
    SELECT r.role_id
    INTO v_role_id
    FROM identity.roles r
    WHERE LOWER(REGEXP_REPLACE(r.role_name, '[^a-zA-Z0-9]+', '', 'g')) =
          LOWER(REGEXP_REPLACE(p_role_name, '[^a-zA-Z0-9]+', '', 'g'))
      AND r.is_active = TRUE;

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role not found or inactive';
    END IF;

    INSERT INTO identity.internal_users (
        email,
        username,
        first_name,
        middle_name,
        surname,
        service_number,
        password_hash,
        role_id,
        status
    )
    VALUES (
        p_email,
        p_username,
        p_first_name,
        NULLIF(p_middle_name, ''),
        p_surname,
        p_service_number,
        p_password_hash,
        v_role_id,
        'Active'
    )
    RETURNING internal_users.internal_user_id INTO v_internal_user_id;

    RETURN QUERY
    SELECT
        iu.internal_user_id,
        iu.email,
        r.role_name AS role
    FROM identity.internal_users iu
    JOIN identity.roles r ON r.role_id = iu.role_id
    WHERE iu.internal_user_id = v_internal_user_id;
END;
$$;

-- register_internal_user stored procedure
CREATE OR REPLACE PROCEDURE identity.register_internal_user_sp(
    IN p_email VARCHAR(255),
    IN p_username VARCHAR(100),
    IN p_first_name VARCHAR(100),
    IN p_middle_name VARCHAR(100),
    IN p_surname VARCHAR(100),
    IN p_service_number VARCHAR(100),
    IN p_password_hash VARCHAR(255),
    IN p_role_name VARCHAR(100),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.register_internal_user(
        p_email,
        p_username,
        p_first_name,
        p_middle_name,
        p_surname,
        p_service_number,
        p_password_hash,
        p_role_name
    );
END;
$$;

-- update_internal_user_role function
CREATE OR REPLACE FUNCTION identity.update_internal_user_role(
    p_internal_user_id UUID,
    p_role_name VARCHAR(100)
)
RETURNS TABLE (
    internal_user_id UUID,
    email VARCHAR(255),
    role VARCHAR(100)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_role_id UUID;
BEGIN
    SELECT role_id
    INTO v_role_id
    FROM identity.roles
    WHERE role_name = p_role_name
      AND is_active = TRUE;

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role not found or inactive';
    END IF;

    UPDATE identity.internal_users AS iu
    SET role_id = v_role_id,
        updated_at = NOW()
    WHERE iu.internal_user_id = p_internal_user_id;

    RETURN QUERY
    SELECT
        iu.internal_user_id,
        iu.email,
        r.role_name AS role
    FROM identity.internal_users iu
    JOIN identity.roles r ON r.role_id = iu.role_id
    WHERE iu.internal_user_id = p_internal_user_id;
END;
$$;

-- update_internal_user_role stored procedure
CREATE OR REPLACE PROCEDURE identity.update_internal_user_role_sp(
    IN p_internal_user_id UUID,
    IN p_role_name VARCHAR(100),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.update_internal_user_role(p_internal_user_id, p_role_name);
END;
$$;

-- internal_login function
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
DECLARE
    v_internal_user_id UUID;
    v_current_password_hash VARCHAR(255);
    v_role_name VARCHAR(100);
    v_status VARCHAR(50);
BEGIN
    SELECT
        iu.internal_user_id,
        iu.password_hash,
        r.role_name,
        iu.status
    INTO
        v_internal_user_id,
        v_current_password_hash,
        v_role_name,
        v_status
    FROM
        identity.internal_users iu
        JOIN identity.roles r ON r.role_id = iu.role_id
    WHERE
        iu.email = p_email;

    IF v_internal_user_id IS NOT NULL AND v_current_password_hash = p_password_hash THEN
        IF v_status = 'Active' THEN
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
        RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, 'Invalid credentials'::TEXT;
    END IF;
END;
$$;

-- internal_login stored procedure
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

COMMIT;

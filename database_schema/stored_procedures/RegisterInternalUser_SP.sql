-- Function for Registering an Internal User (PostgreSQL)
DROP PROCEDURE IF EXISTS identity.register_internal_user_sp(VARCHAR(255), VARCHAR(100), VARCHAR(100), VARCHAR(100), VARCHAR(100), VARCHAR(100), VARCHAR(255), VARCHAR(100));
DROP FUNCTION IF EXISTS identity.register_internal_user(VARCHAR(255), VARCHAR(100), VARCHAR(100), VARCHAR(100), VARCHAR(100), VARCHAR(100), VARCHAR(255), VARCHAR(100));

CREATE OR REPLACE FUNCTION identity.register_internal_user(
    p_email VARCHAR(255),
    p_username VARCHAR(100),
    p_first_name VARCHAR(100),
    p_middle_name VARCHAR(100),
    p_surname VARCHAR(100),
    p_service_number VARCHAR(100),
    p_unit_id UUID,
    p_password_hash VARCHAR(255),
    p_role_name VARCHAR(100)
)
RETURNS TABLE (
    internal_user_id UUID,
    email VARCHAR(255),
    role VARCHAR(100),
    unit_id UUID,
    unit_name VARCHAR(150)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_RoleID UUID;
    v_InternalUserID UUID;
    v_UnitName VARCHAR(150);
BEGIN
    SELECT role_id
    INTO v_RoleID
    FROM identity.roles
    WHERE role_name = p_role_name
      AND is_active = TRUE;

    IF v_RoleID IS NULL THEN
        RAISE EXCEPTION 'Role not found or inactive';
    END IF;

    SELECT ou.unit_name
    INTO v_UnitName
    FROM identity.organizational_units ou
    WHERE ou.unit_id = p_unit_id
      AND ou.is_active = TRUE
      AND ou.is_assignable = TRUE;

    IF v_UnitName IS NULL THEN
        RAISE EXCEPTION 'Organizational unit not found or not assignable';
    END IF;

    INSERT INTO identity.internal_users (
        email,
        username,
        first_name,
        middle_name,
        surname,
        service_number,
        unit_id,
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
        p_unit_id,
        p_password_hash,
        v_RoleID,
        'Active'
    )
    RETURNING internal_users.internal_user_id INTO v_InternalUserID;

    RETURN QUERY
    SELECT
        iu.internal_user_id,
        iu.email,
        r.role_name AS role,
        iu.unit_id,
        ou.unit_name
    FROM identity.internal_users iu
    JOIN identity.roles r ON r.role_id = iu.role_id
    LEFT JOIN identity.organizational_units ou ON ou.unit_id = iu.unit_id
    WHERE iu.internal_user_id = v_InternalUserID;
END;
$$;

-- Procedure wrapper for register_internal_user (PostgreSQL)
CREATE OR REPLACE PROCEDURE identity.register_internal_user_sp(
    IN p_email VARCHAR(255),
    IN p_username VARCHAR(100),
    IN p_first_name VARCHAR(100),
    IN p_middle_name VARCHAR(100),
    IN p_surname VARCHAR(100),
    IN p_service_number VARCHAR(100),
    IN p_unit_id UUID,
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
        p_unit_id,
        p_password_hash,
        p_role_name
    );
END;
$$;

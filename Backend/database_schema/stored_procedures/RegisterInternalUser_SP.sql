-- Function for Registering an Internal User (PostgreSQL)
CREATE OR REPLACE FUNCTION identity.register_internal_user(
    p_email VARCHAR(255),
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
    v_RoleID UUID;
    v_InternalUserID UUID;
BEGIN
    SELECT RoleID
    INTO v_RoleID
    FROM identity.Roles
    WHERE RoleName = p_role_name
      AND IsActive = TRUE;

    IF v_RoleID IS NULL THEN
        RAISE EXCEPTION 'Role not found or inactive';
    END IF;

    INSERT INTO identity.InternalUsers (Email, PasswordHash, RoleID, Status)
    VALUES (p_email, p_password_hash, v_RoleID, 'Active')
    RETURNING InternalUsers.InternalUserID INTO v_InternalUserID;

    RETURN QUERY
    SELECT
        IU.InternalUserID,
        IU.Email,
        R.RoleName AS Role
    FROM identity.InternalUsers IU
    JOIN identity.Roles R ON R.RoleID = IU.RoleID
    WHERE IU.InternalUserID = v_InternalUserID;
END;
$$;

-- Procedure wrapper for register_internal_user (PostgreSQL)
CREATE OR REPLACE PROCEDURE identity.register_internal_user_sp(
    IN p_email VARCHAR(255),
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
        p_password_hash,
        p_role_name
    );
END;
$$;

-- Function for Updating an Internal User Role (PostgreSQL)
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
    v_RoleID UUID;
BEGIN
    SELECT RoleID
    INTO v_RoleID
    FROM identity.Roles
    WHERE RoleName = p_role_name
      AND IsActive = TRUE;

    IF v_RoleID IS NULL THEN
        RAISE EXCEPTION 'Role not found or inactive';
    END IF;

    UPDATE identity.InternalUsers
    SET RoleID = v_RoleID,
        UpdatedAt = NOW()
    WHERE InternalUserID = p_internal_user_id;

    RETURN QUERY
    SELECT
        IU.InternalUserID,
        IU.Email,
        R.RoleName AS Role
    FROM identity.InternalUsers IU
    JOIN identity.Roles R ON R.RoleID = IU.RoleID
    WHERE IU.InternalUserID = p_internal_user_id;
END;
$$;

-- Procedure wrapper for update_internal_user_role (PostgreSQL)
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

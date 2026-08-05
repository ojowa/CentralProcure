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
    v_IsSystemAdmin BOOLEAN;
BEGIN
    SELECT role_id
    INTO v_RoleID
    FROM identity.roles
    WHERE role_name = p_role_name
      AND is_active = TRUE;

    IF v_RoleID IS NULL THEN
        RAISE EXCEPTION 'Role not found or inactive';
    END IF;

    v_IsSystemAdmin := p_role_name IN ('Admin', 'SystemAdministrator', 'ict_admin');

    UPDATE identity.internal_users
    SET role_id = v_RoleID,
        unit_id = CASE WHEN v_IsSystemAdmin THEN NULL ELSE unit_id END,
        updated_at = NOW()
    WHERE internal_user_id = p_internal_user_id;

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

-- Function for Deactivating a Role (PostgreSQL)
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

-- Procedure wrapper for deactivate_role (PostgreSQL)
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

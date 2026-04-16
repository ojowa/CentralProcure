-- Function for Deleting a Role (PostgreSQL)
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
    IF EXISTS (SELECT 1 FROM identity.internal_users WHERE internal_users.role_id = p_role_id) THEN
        RAISE EXCEPTION 'Role is in use and cannot be deleted';
    END IF;

    RETURN QUERY
    DELETE FROM identity.roles
    WHERE roles.role_id = p_role_id
    RETURNING roles.role_id, roles.role_name, roles.description, roles.is_active;
END;
$$;

-- Procedure wrapper for delete_role (PostgreSQL)
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

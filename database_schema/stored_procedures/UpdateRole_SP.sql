-- Function for Updating a Role (PostgreSQL)
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
        IF EXISTS (SELECT 1 FROM identity.roles WHERE roles.role_name = p_role_name AND roles.role_id <> p_role_id) THEN
            RAISE EXCEPTION 'Role name already exists';
        END IF;
    END IF;

    UPDATE identity.roles
    SET
        role_name = COALESCE(p_role_name, roles.role_name),
        description = COALESCE(p_description, roles.description),
        is_active = COALESCE(p_is_active, roles.is_active),
        updated_at = NOW()
    WHERE roles.role_id = p_role_id;

    RETURN QUERY
    SELECT roles.role_id, roles.role_name, roles.description, roles.is_active
    FROM identity.roles
    WHERE roles.role_id = p_role_id;
END;
$$;

-- Procedure wrapper for update_role (PostgreSQL)
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

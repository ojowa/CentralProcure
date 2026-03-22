-- Function for Updating a Role (PostgreSQL)
CREATE OR REPLACE FUNCTION identity.update_role(
    p_role_id UUID,
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
    UPDATE identity.roles
    SET role_name = p_role_name,
        description = p_description,
        updated_at = NOW()
    WHERE role_id = p_role_id;

    RETURN QUERY
    SELECT r.role_id, r.role_name, r.description, r.is_active
    FROM identity.roles r
    WHERE r.role_id = p_role_id;
END;
$$;

-- Procedure wrapper for update_role
CREATE OR REPLACE PROCEDURE identity.update_role_sp(
    IN p_role_id UUID,
    IN p_role_name VARCHAR(100),
    IN p_description TEXT,
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.update_role(p_role_id, p_role_name, p_description);
END;
$$;

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
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE role_id = p_role_id;

    RETURN QUERY
    SELECT r.role_id, r.role_name, r.description, r.is_active
    FROM identity.roles r
    WHERE r.role_id = p_role_id;
END;
$$;

-- Procedure wrapper for deactivate_role
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

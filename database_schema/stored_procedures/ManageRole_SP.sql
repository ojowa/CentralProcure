-- Function for Creating a Role (PostgreSQL)
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

-- Procedure wrapper for create_role
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

-- Function for Getting Roles (PostgreSQL)
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
    SELECT roles.role_id, roles.role_name, roles.description, roles.is_active
    FROM identity.roles
    ORDER BY roles.role_name ASC;
END;
$$;

-- Procedure wrapper for get_roles
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

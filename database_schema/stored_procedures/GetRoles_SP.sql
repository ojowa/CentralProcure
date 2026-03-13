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

-- Procedure wrapper for get_roles (PostgreSQL)
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

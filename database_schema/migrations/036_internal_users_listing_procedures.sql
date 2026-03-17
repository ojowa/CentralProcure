CREATE OR REPLACE FUNCTION identity.get_internal_users()
RETURNS TABLE (
    internal_user_id UUID,
    email VARCHAR(255),
    username VARCHAR(100),
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    surname VARCHAR(100),
    service_number VARCHAR(100),
    unit_id UUID,
    unit_name VARCHAR(150),
    role_name VARCHAR(100),
    status VARCHAR(50),
    last_login TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        iu.internal_user_id,
        iu.email,
        iu.username,
        iu.first_name,
        iu.middle_name,
        iu.surname,
        iu.service_number,
        iu.unit_id,
        ou.unit_name,
        r.role_name,
        iu.status,
        iu.last_login,
        iu.created_at
    FROM identity.internal_users iu
    JOIN identity.roles r ON r.role_id = iu.role_id
    LEFT JOIN identity.organizational_units ou ON ou.unit_id = iu.unit_id
    ORDER BY iu.created_at DESC;
END;
$$;

CREATE OR REPLACE PROCEDURE identity.get_internal_users_sp(
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.get_internal_users();
END;
$$;

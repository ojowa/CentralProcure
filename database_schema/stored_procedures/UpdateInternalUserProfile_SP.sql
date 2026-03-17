-- Function to update Internal User Profile (PostgreSQL)
CREATE OR REPLACE FUNCTION identity.update_internal_user_profile(
    p_internal_user_id UUID,
    p_username VARCHAR(100),
    p_first_name VARCHAR(100),
    p_middle_name VARCHAR(100),
    p_surname VARCHAR(100)
)
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
    UPDATE identity.internal_users
    SET
        username = p_username,
        first_name = p_first_name,
        middle_name = NULLIF(p_middle_name, ''),
        surname = p_surname,
        updated_at = NOW()
    WHERE
        internal_users.internal_user_id = p_internal_user_id;

    RETURN QUERY
    SELECT * FROM identity.get_internal_user_profile(p_internal_user_id);
END;
$$;

-- Procedure wrapper for update_internal_user_profile
CREATE OR REPLACE PROCEDURE identity.update_internal_user_profile_sp(
    IN p_internal_user_id UUID,
    IN p_username VARCHAR(100),
    IN p_first_name VARCHAR(100),
    IN p_middle_name VARCHAR(100),
    IN p_surname VARCHAR(100),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.update_internal_user_profile(
        p_internal_user_id,
        p_username,
        p_first_name,
        p_middle_name,
        p_surname
    );
END;
$$;

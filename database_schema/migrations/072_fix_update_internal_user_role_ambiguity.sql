BEGIN;

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
    v_role_id UUID;
BEGIN
    SELECT r.role_id
    INTO v_role_id
    FROM identity.roles r
    WHERE LOWER(REGEXP_REPLACE(r.role_name, '[^a-zA-Z0-9]+', '', 'g')) =
          LOWER(REGEXP_REPLACE(p_role_name, '[^a-zA-Z0-9]+', '', 'g'))
      AND r.is_active = TRUE;

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role not found or inactive';
    END IF;

    UPDATE identity.internal_users AS iu
    SET role_id = v_role_id,
        updated_at = NOW()
    WHERE iu.internal_user_id = p_internal_user_id;

    RETURN QUERY
    SELECT
        iu.internal_user_id,
        iu.email,
        r.role_name AS role
    FROM identity.internal_users AS iu
    JOIN identity.roles AS r ON r.role_id = iu.role_id
    WHERE iu.internal_user_id = p_internal_user_id;
END;
$$;

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

COMMIT;

BEGIN;

ALTER TABLE identity.internal_users
    ADD COLUMN IF NOT EXISTS username VARCHAR(100),
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS surname VARCHAR(100),
    ADD COLUMN IF NOT EXISTS service_number VARCHAR(100);

WITH ordered_users AS (
    SELECT
        iu.internal_user_id,
        iu.email,
        trim(regexp_replace(split_part(iu.email, '@', 1), '[^a-zA-Z0-9]+', ' ', 'g')) AS email_name,
        row_number() OVER (ORDER BY iu.created_at, iu.internal_user_id) AS sequence_no
    FROM identity.internal_users iu
),
derived_values AS (
    SELECT
        ou.internal_user_id,
        COALESCE(NULLIF(lower(regexp_replace(split_part(ou.email, '@', 1), '[^a-zA-Z0-9]+', '_', 'g')), ''), 'internal_user_' || ou.sequence_no) AS username_value,
        COALESCE(NULLIF(initcap(split_part(ou.email_name, ' ', 1)), ''), 'Internal') AS first_name_value,
        COALESCE(
            NULLIF(initcap(reverse(split_part(reverse(ou.email_name), ' ', 1))), ''),
            'User'
        ) AS surname_value,
        'NIS-' || lpad(ou.sequence_no::text, 5, '0') AS service_number_value
    FROM ordered_users ou
)
UPDATE identity.internal_users iu
SET
    username = COALESCE(iu.username, dv.username_value),
    first_name = COALESCE(iu.first_name, dv.first_name_value),
    middle_name = COALESCE(iu.middle_name, NULL),
    surname = COALESCE(iu.surname, dv.surname_value),
    service_number = COALESCE(iu.service_number, dv.service_number_value),
    updated_at = NOW()
FROM derived_values dv
WHERE iu.internal_user_id = dv.internal_user_id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_internal_users_username_lower
    ON identity.internal_users (lower(username));

CREATE UNIQUE INDEX IF NOT EXISTS ux_internal_users_service_number_lower
    ON identity.internal_users (lower(service_number));

ALTER TABLE identity.internal_users
    ALTER COLUMN username SET NOT NULL,
    ALTER COLUMN first_name SET NOT NULL,
    ALTER COLUMN surname SET NOT NULL,
    ALTER COLUMN service_number SET NOT NULL;

DROP PROCEDURE IF EXISTS identity.register_internal_user_sp(VARCHAR, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS identity.register_internal_user(VARCHAR, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION identity.register_internal_user(
    p_email VARCHAR(255),
    p_username VARCHAR(100),
    p_first_name VARCHAR(100),
    p_middle_name VARCHAR(100),
    p_surname VARCHAR(100),
    p_service_number VARCHAR(100),
    p_password_hash VARCHAR(255),
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
    v_internal_user_id UUID;
BEGIN
    SELECT role_id
    INTO v_role_id
    FROM identity.roles
    WHERE role_name = p_role_name
      AND is_active = TRUE;

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role not found or inactive';
    END IF;

    INSERT INTO identity.internal_users (
        email,
        username,
        first_name,
        middle_name,
        surname,
        service_number,
        password_hash,
        role_id,
        status
    )
    VALUES (
        p_email,
        p_username,
        p_first_name,
        NULLIF(p_middle_name, ''),
        p_surname,
        p_service_number,
        p_password_hash,
        v_role_id,
        'Active'
    )
    RETURNING internal_users.internal_user_id INTO v_internal_user_id;

    RETURN QUERY
    SELECT
        iu.internal_user_id,
        iu.email,
        r.role_name AS role
    FROM identity.internal_users iu
    JOIN identity.roles r ON r.role_id = iu.role_id
    WHERE iu.internal_user_id = v_internal_user_id;
END;
$$;

CREATE OR REPLACE PROCEDURE identity.register_internal_user_sp(
    IN p_email VARCHAR(255),
    IN p_username VARCHAR(100),
    IN p_first_name VARCHAR(100),
    IN p_middle_name VARCHAR(100),
    IN p_surname VARCHAR(100),
    IN p_service_number VARCHAR(100),
    IN p_password_hash VARCHAR(255),
    IN p_role_name VARCHAR(100),
    OUT p_result refcursor
)
LANGUAGE plpgsql
AS $$
BEGIN
    OPEN p_result FOR
    SELECT * FROM identity.register_internal_user(
        p_email,
        p_username,
        p_first_name,
        p_middle_name,
        p_surname,
        p_service_number,
        p_password_hash,
        p_role_name
    );
END;
$$;

COMMIT;

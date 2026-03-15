-- Seed a default internal admin user (PostgreSQL)
-- IMPORTANT: This uses a valid BCrypt hash for 'password123'.
DO $$
DECLARE
    v_email TEXT := 'admin@nis.gov.ng';
    -- Valid BCrypt hash for 'password123'
    v_password_hash TEXT := '$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK';
    v_role_id UUID;
BEGIN
    SELECT role_id
    INTO v_role_id
    FROM identity.roles
    WHERE role_name = 'Admin';

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Admin role not found. Run 001_roles.sql first.';
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
        v_email,
        'admin',
        'System',
        NULL,
        'Administrator',
        'NIS-00001',
        v_password_hash,
        v_role_id,
        'Active'
    )
    ON CONFLICT (email) DO UPDATE
    SET password_hash = v_password_hash,
        username = 'admin',
        first_name = 'System',
        middle_name = NULL,
        surname = 'Administrator',
        service_number = 'NIS-00001',
        status = 'Active';
END;
$$;

UPDATE identity.internal_users iu
SET
    unit_id = ou.unit_id,
    updated_at = NOW()
FROM identity.organizational_units ou
WHERE iu.email = 'admin@nis.gov.ng'
  AND ou.unit_name = 'ICT and Cyber Security';

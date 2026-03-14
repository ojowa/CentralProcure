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

    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    VALUES (v_email, v_password_hash, v_role_id, 'Active')
    ON CONFLICT (email) DO UPDATE
    SET password_hash = v_password_hash,
        status = 'Active';
END;
$$;

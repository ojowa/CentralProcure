-- Seed internal users by department (PostgreSQL)
DO $$
DECLARE
    -- Valid BCrypt hash for 'password123'
    v_password_hash TEXT := '$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK';
BEGIN
    -- Procurement
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'procurement@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'ProcurementOfficer'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';

    -- Finance
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'finance@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'PaymentOfficer'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';

    -- Audit
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'audit@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'AuditOfficer'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';

    -- ICT
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'ict@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'SystemAdministrator'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';
END;
$$;

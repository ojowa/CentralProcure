-- Seed internal users by department (PostgreSQL)
DO $$
DECLARE
    -- Valid BCrypt hash for 'password123' + 'NIS_EPROC_SUPER_SECRET_PEPPER_2026'
    v_password_hash TEXT := '$2a$12$BS9Cmmeh4buLAz.ICDrPN.7Qd60wL0Abb6e8d3Gn/dYMwMJ3tEmNu'; 
BEGIN
    -- Procurement
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'procurement@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'ProcurementOfficer'
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    -- Finance
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'finance@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'PaymentOfficer'
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    -- Audit
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'audit@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'AuditOfficer'
    ON CONFLICT (email) DO NOTHING;

    -- ICT
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'ict@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'SystemAdministrator'
    ON CONFLICT (email) DO NOTHING;
END;
$$;

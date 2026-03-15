-- Seed internal users by department (PostgreSQL)
DO $$
DECLARE
    -- Valid BCrypt hash for 'password123'
    v_password_hash TEXT := '$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK';
BEGIN
    -- Procurement
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
    SELECT 'procurement@nis.gov.ng', 'procurement', 'Procurement', NULL, 'Officer', 'NIS-00002', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'ProcurementOfficer'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- Finance
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
    SELECT 'finance@nis.gov.ng', 'finance', 'Finance', NULL, 'Officer', 'NIS-00003', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'PaymentOfficer'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- Audit
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
    SELECT 'audit@nis.gov.ng', 'audit', 'Audit', NULL, 'Officer', 'NIS-00004', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'AuditOfficer'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- ICT
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
    SELECT 'ict@nis.gov.ng', 'ict', 'ICT', NULL, 'Administrator', 'NIS-00005', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'SystemAdministrator'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';
END;
$$;

UPDATE identity.internal_users iu
SET
    unit_id = ou.unit_id,
    updated_at = NOW()
FROM identity.organizational_units ou
WHERE (
        (iu.email = 'procurement@nis.gov.ng' AND ou.unit_name = 'Procurement')
     OR (iu.email = 'finance@nis.gov.ng' AND ou.unit_name = 'Finance and Accounts')
     OR (iu.email = 'audit@nis.gov.ng' AND ou.unit_name = 'Internal Audits')
     OR (iu.email = 'ict@nis.gov.ng' AND ou.unit_name = 'ICT and Cyber Security')
)
AND iu.email IN ('procurement@nis.gov.ng', 'finance@nis.gov.ng', 'audit@nis.gov.ng', 'ict@nis.gov.ng');

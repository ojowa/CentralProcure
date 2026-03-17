-- Seed additional internal workflow users for expanded PPA-aligned roles (PostgreSQL)
DO $$
DECLARE
    -- Valid BCrypt hash for 'password123'
    v_password_hash TEXT := '$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK';
BEGIN
    -- PlanningStatisticsOfficer
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
    SELECT 'planningstatisticsofficer@nis.gov.ng', 'planningstatisticsofficer', 'Planning', NULL, 'Statistics Officer', 'NIS-00017', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'PlanningStatisticsOfficer'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- FinancialUnitOfficer
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
    SELECT 'financialunitofficer@nis.gov.ng', 'financialunitofficer', 'Financial', NULL, 'Unit Officer', 'NIS-00018', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'FinancialUnitOfficer'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- LegalReviewer
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
    SELECT 'legalreviewer@nis.gov.ng', 'legalreviewer', 'Legal', NULL, 'Reviewer', 'NIS-00019', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'LegalReviewer'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- BPPReviewer
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
    SELECT 'bppreviewer@nis.gov.ng', 'bppreviewer', 'BPP', NULL, 'Reviewer', 'NIS-00020', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'BPPReviewer'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- ComplaintsReviewOfficer
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
    SELECT 'complaintsreviewofficer@nis.gov.ng', 'complaintsreviewofficer', 'Complaints', NULL, 'Review Officer', 'NIS-00021', v_password_hash, role_id, 'Active'
    FROM identity.roles
    WHERE role_name = 'ComplaintsReviewOfficer'
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
        (iu.email = 'planningstatisticsofficer@nis.gov.ng' AND ou.unit_name = 'Planning, Research and Statistics')
     OR (iu.email = 'financialunitofficer@nis.gov.ng' AND ou.unit_name = 'Finance and Accounts')
     OR (iu.email = 'legalreviewer@nis.gov.ng' AND ou.unit_name = 'Legal')
     OR (iu.email = 'bppreviewer@nis.gov.ng' AND ou.unit_name = 'Procurement')
     OR (iu.email = 'complaintsreviewofficer@nis.gov.ng' AND ou.unit_name = 'SERVICOM')
)
AND iu.email IN (
    'planningstatisticsofficer@nis.gov.ng',
    'financialunitofficer@nis.gov.ng',
    'legalreviewer@nis.gov.ng',
    'bppreviewer@nis.gov.ng',
    'complaintsreviewofficer@nis.gov.ng'
);

-- Seed remaining internal users by role (PostgreSQL)
DO $$
DECLARE
    -- Valid BCrypt hash for 'password123'
    v_password_hash TEXT := '$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK';
BEGIN
    -- Admin
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'admin@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'Admin'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';

    -- RequisitioningOfficer
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'requisitioningofficer@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'RequisitioningOfficer'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';

    -- DepartmentHead
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'departmenthead@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'DepartmentHead'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';

    -- ProcurementManager
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'procurementmanager@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'ProcurementManager'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';

    -- TechnicalEvaluator
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'technicalevaluator@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'TechnicalEvaluator'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';

    -- FinancialEvaluator
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'financialevaluator@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'FinancialEvaluator'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';

    -- TendersBoardMember
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'tendersboardmember@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'TendersBoardMember'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';

    -- TendersBoardSecretary
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'tendersboardsecretary@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'TendersBoardSecretary'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';

    -- AccountingOfficer
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'accountingofficer@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'AccountingOfficer'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';

    -- BPPLiaison
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'bppliaison@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'BPPLiaison'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';

    -- ContractManager
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'contractmanager@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'ContractManager'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';

    -- InspectionOfficer
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'inspectionofficer@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'InspectionOfficer'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        status = 'Active';
END;
$$;

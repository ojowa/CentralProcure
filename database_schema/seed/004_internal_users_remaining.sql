-- Seed remaining internal users by role (PostgreSQL)
DO $$
DECLARE
    -- Valid BCrypt hash for 'password123' + 'NIS_EPROC_SUPER_SECRET_PEPPER_2026'
    v_password_hash TEXT := '$2a$12$BS9Cmmeh4buLAz.ICDrPN.7Qd60wL0Abb6e8d3Gn/dYMwMJ3tEmNu'; 
BEGIN
    -- Admin
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'admin@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'Admin'
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    -- RequisitioningOfficer
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'requisitioningofficer@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'RequisitioningOfficer'
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    -- DepartmentHead
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'departmenthead@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'DepartmentHead'
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    -- ProcurementManager
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'procurementmanager@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'ProcurementManager'
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    -- TechnicalEvaluator
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'technicalevaluator@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'TechnicalEvaluator'
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    -- FinancialEvaluator
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'financialevaluator@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'FinancialEvaluator'
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    -- TendersBoardMember
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'tendersboardmember@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'TendersBoardMember'
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    -- TendersBoardSecretary
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'tendersboardsecretary@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'TendersBoardSecretary'
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    -- AccountingOfficer
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'accountingofficer@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'AccountingOfficer'
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    -- BPPLiaison
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'bppliaison@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'BPPLiaison'
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    -- ContractManager
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'contractmanager@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'ContractManager'
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    -- InspectionOfficer
    INSERT INTO identity.internal_users (email, password_hash, role_id, status)
    SELECT 'inspectionofficer@nis.gov.ng', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'InspectionOfficer'
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
END;
$$;

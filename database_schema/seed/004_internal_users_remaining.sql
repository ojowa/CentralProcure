-- Seed remaining internal users by role (PostgreSQL)
DO $$
DECLARE
    -- Valid BCrypt hash for 'password123'
    v_password_hash TEXT := '$2a$11$HqQPXr4hOWV2V.667CeI0u3rrJdr/YZMM5GJJ7fWtDV77AiwanXrK';
BEGIN
    -- Admin
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
    SELECT 'admin@nis.gov.ng', 'admin', 'System', NULL, 'Administrator', 'NIS-00001', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'Admin'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- RequisitioningOfficer
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
    SELECT 'requisitioningofficer@nis.gov.ng', 'requisitioningofficer', 'Requisitioning', NULL, 'Officer', 'NIS-00006', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'RequisitioningOfficer'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- DepartmentHead
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
    SELECT 'departmenthead@nis.gov.ng', 'departmenthead', 'Department', NULL, 'Head', 'NIS-00007', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'DepartmentHead'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- ProcurementManager
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
    SELECT 'procurementmanager@nis.gov.ng', 'procurementmanager', 'Procurement', NULL, 'Manager', 'NIS-00008', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'ProcurementManager'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- TechnicalEvaluator
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
    SELECT 'technicalevaluator@nis.gov.ng', 'technicalevaluator', 'Technical', NULL, 'Evaluator', 'NIS-00009', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'TechnicalEvaluator'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- FinancialEvaluator
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
    SELECT 'financialevaluator@nis.gov.ng', 'financialevaluator', 'Financial', NULL, 'Evaluator', 'NIS-00010', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'FinancialEvaluator'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- TendersBoardMember
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
    SELECT 'tendersboardmember@nis.gov.ng', 'tendersboardmember', 'Tenders', NULL, 'Board Member', 'NIS-00011', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'TendersBoardMember'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- TendersBoardSecretary
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
    SELECT 'tendersboardsecretary@nis.gov.ng', 'tendersboardsecretary', 'Tenders', NULL, 'Board Secretary', 'NIS-00012', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'TendersBoardSecretary'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- CGIS
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
    SELECT 'cgis@nis.gov.ng', 'cgis', 'CGIS', NULL, 'Executive', 'NIS-00013', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'CGIS'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- BPPLiaison
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
    SELECT 'bppliaison@nis.gov.ng', 'bppliaison', 'BPP', NULL, 'Liaison', 'NIS-00014', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'BPPLiaison'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- ContractManager
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
    SELECT 'contractmanager@nis.gov.ng', 'contractmanager', 'Contract', NULL, 'Manager', 'NIS-00015', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'ContractManager'
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        surname = EXCLUDED.surname,
        service_number = EXCLUDED.service_number,
        status = 'Active';

    -- InspectionOfficer
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
    SELECT 'inspectionofficer@nis.gov.ng', 'inspectionofficer', 'Inspection', NULL, 'Officer', 'NIS-00016', v_password_hash, role_id, 'Active'
    FROM identity.roles WHERE role_name = 'InspectionOfficer'
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
        (iu.email = 'admin@nis.gov.ng' AND ou.unit_name = 'ICT and Cyber Security')
     OR (iu.email IN ('requisitioningofficer@nis.gov.ng', 'departmenthead@nis.gov.ng', 'contractmanager@nis.gov.ng', 'inspectionofficer@nis.gov.ng') AND ou.unit_name = 'Works and Logistics')
     OR (iu.email IN ('procurementmanager@nis.gov.ng', 'tendersboardmember@nis.gov.ng', 'tendersboardsecretary@nis.gov.ng', 'bppliaison@nis.gov.ng') AND ou.unit_name = 'Procurement')
     OR (iu.email = 'technicalevaluator@nis.gov.ng' AND ou.unit_name = 'ICT and Cyber Security')
     OR (iu.email IN ('financialevaluator@nis.gov.ng', 'accountingofficer@nis.gov.ng') AND ou.unit_name = 'Finance and Accounts')
)
AND iu.email IN (
    'admin@nis.gov.ng',
    'requisitioningofficer@nis.gov.ng',
    'departmenthead@nis.gov.ng',
    'procurementmanager@nis.gov.ng',
    'technicalevaluator@nis.gov.ng',
    'financialevaluator@nis.gov.ng',
    'tendersboardmember@nis.gov.ng',
    'tendersboardsecretary@nis.gov.ng',
    'accountingofficer@nis.gov.ng',
    'bppliaison@nis.gov.ng',
    'contractmanager@nis.gov.ng',
    'inspectionofficer@nis.gov.ng'
);

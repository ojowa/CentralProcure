BEGIN;

CREATE TABLE IF NOT EXISTS identity.organizational_units (
    unit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_code VARCHAR(60) NOT NULL UNIQUE,
    unit_name VARCHAR(150) NOT NULL,
    unit_type VARCHAR(50) NOT NULL,
    parent_unit_id UUID NULL REFERENCES identity.organizational_units(unit_id) ON DELETE SET NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_assignable BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_organizational_units_name_ci
    ON identity.organizational_units (LOWER(unit_name));

CREATE INDEX IF NOT EXISTS ix_organizational_units_parent_unit_id
    ON identity.organizational_units (parent_unit_id);

INSERT INTO identity.organizational_units (
    unit_code,
    unit_name,
    unit_type,
    parent_unit_id,
    sort_order,
    is_assignable,
    is_active
)
VALUES
    ('CGNIS', 'Comptroller General, NIS', 'Executive', NULL, 10, FALSE, TRUE),
    ('DIRECTORATES', 'Directorates', 'Group', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'CGNIS'), 20, FALSE, TRUE),
    ('SPECIALIZED_UNITS', 'Specialized Units', 'Group', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'CGNIS'), 30, FALSE, TRUE),
    ('HRM', 'Human Resources Management', 'Directorate', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'DIRECTORATES'), 100, TRUE, TRUE),
    ('FINACC', 'Finance and Accounts', 'Directorate', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'DIRECTORATES'), 110, TRUE, TRUE),
    ('PRS', 'Planning, Research and Statistics', 'Directorate', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'DIRECTORATES'), 120, TRUE, TRUE),
    ('PPTD', 'Passport and Other Travel Documents', 'Directorate', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'DIRECTORATES'), 130, TRUE, TRUE),
    ('INVCOMP', 'Investigation and Compliance', 'Directorate', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'DIRECTORATES'), 140, TRUE, TRUE),
    ('BORDER', 'Border Management', 'Directorate', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'DIRECTORATES'), 150, TRUE, TRUE),
    ('MIGRATION', 'Migration', 'Directorate', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'DIRECTORATES'), 160, TRUE, TRUE),
    ('VISA', 'Visa and Residency', 'Directorate', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'DIRECTORATES'), 170, TRUE, TRUE),
    ('WORKLOG', 'Works and Logistics', 'Directorate', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'DIRECTORATES'), 180, TRUE, TRUE),
    ('ICTCYBER', 'ICT and Cyber Security', 'Directorate', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'DIRECTORATES'), 190, TRUE, TRUE),
    ('PROC', 'Procurement', 'SpecializedUnit', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'SPECIALIZED_UNITS'), 200, TRUE, TRUE),
    ('LEGAL', 'Legal', 'SpecializedUnit', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'SPECIALIZED_UNITS'), 210, TRUE, TRUE),
    ('INTAUD', 'Internal Audits', 'SpecializedUnit', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'SPECIALIZED_UNITS'), 220, TRUE, TRUE),
    ('SERVICOM', 'SERVICOM', 'SpecializedUnit', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'SPECIALIZED_UNITS'), 230, TRUE, TRUE),
    ('INTSEC', 'Internal Security', 'SpecializedUnit', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'SPECIALIZED_UNITS'), 240, TRUE, TRUE),
    ('PRESSPR', 'Press and Public Relations', 'SpecializedUnit', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'SPECIALIZED_UNITS'), 250, TRUE, TRUE),
    ('ACT', 'Anti-Corruption and Transparency', 'SpecializedUnit', (SELECT unit_id FROM identity.organizational_units WHERE unit_code = 'SPECIALIZED_UNITS'), 260, TRUE, TRUE)
ON CONFLICT (unit_code) DO UPDATE
SET
    unit_name = EXCLUDED.unit_name,
    unit_type = EXCLUDED.unit_type,
    parent_unit_id = EXCLUDED.parent_unit_id,
    sort_order = EXCLUDED.sort_order,
    is_assignable = EXCLUDED.is_assignable,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

ALTER TABLE identity.internal_users
    ADD COLUMN IF NOT EXISTS unit_id UUID NULL REFERENCES identity.organizational_units(unit_id) ON DELETE SET NULL;

ALTER TABLE procurement_workflow.requisitions
    ADD COLUMN IF NOT EXISTS unit_id UUID NULL REFERENCES identity.organizational_units(unit_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_internal_users_unit_id
    ON identity.internal_users (unit_id);

CREATE INDEX IF NOT EXISTS ix_requisitions_unit_id
    ON procurement_workflow.requisitions (unit_id);

UPDATE identity.internal_users iu
SET
    unit_id = ou.unit_id,
    updated_at = NOW()
FROM identity.roles r,
     identity.organizational_units ou
WHERE r.role_id = iu.role_id
  AND ou.unit_name = CASE
        WHEN lower(iu.email) IN ('admin@nis.gov.ng', 'ict@nis.gov.ng') THEN 'ICT and Cyber Security'
        WHEN lower(iu.email) = 'procurement@nis.gov.ng' THEN 'Procurement'
        WHEN lower(iu.email) = 'finance@nis.gov.ng' THEN 'Finance and Accounts'
        WHEN lower(iu.email) = 'audit@nis.gov.ng' THEN 'Internal Audits'
        WHEN lower(iu.email) IN ('requisitioningofficer@nis.gov.ng', 'departmenthead@nis.gov.ng') THEN 'Works and Logistics'
        WHEN lower(iu.email) = 'procurementmanager@nis.gov.ng' THEN 'Procurement'
        WHEN lower(iu.email) = 'technicalevaluator@nis.gov.ng' THEN 'ICT and Cyber Security'
        WHEN lower(iu.email) = 'financialevaluator@nis.gov.ng' THEN 'Finance and Accounts'
        WHEN lower(iu.email) IN ('tendersboardmember@nis.gov.ng', 'tendersboardsecretary@nis.gov.ng', 'bppliaison@nis.gov.ng') THEN 'Procurement'
        WHEN lower(iu.email) = 'accountingofficer@nis.gov.ng' THEN 'Finance and Accounts'
        WHEN lower(iu.email) IN ('contractmanager@nis.gov.ng', 'inspectionofficer@nis.gov.ng') THEN 'Works and Logistics'
        WHEN r.role_name IN ('SystemAdministrator') THEN 'ICT and Cyber Security'
        WHEN r.role_name IN ('ComptrollerProcurement', 'ProcurementManager', 'BPPLiaison', 'TendersBoardMember', 'TendersBoardSecretary') THEN 'Procurement'
        WHEN r.role_name IN ('PaymentOfficer', 'AccountingOfficer', 'FinancialEvaluator') THEN 'Finance and Accounts'
        WHEN r.role_name IN ('AuditOfficer') THEN 'Internal Audits'
        WHEN r.role_name IN ('RequisitioningOfficer', 'DepartmentHead', 'ContractManager', 'InspectionOfficer') THEN 'Works and Logistics'
        WHEN r.role_name IN ('TechnicalEvaluator') THEN 'ICT and Cyber Security'
        ELSE NULL
    END
  AND ou.is_active = TRUE
  AND ou.is_assignable = TRUE
  AND (
      iu.unit_id IS NULL
      OR iu.unit_id IS DISTINCT FROM ou.unit_id
  );

UPDATE procurement_workflow.requisitions r
SET
    unit_id = ou.unit_id,
    department = ou.unit_name,
    updated_at = NOW()
FROM identity.organizational_units ou
WHERE LOWER(ou.unit_name) = LOWER(
    CASE
        WHEN LOWER(r.department) = 'operations command' THEN 'Border Management'
        WHEN LOWER(r.department) = 'ict directorate' THEN 'ICT and Cyber Security'
        WHEN LOWER(r.department) = 'border intelligence' THEN 'Border Management'
        WHEN LOWER(r.department) = 'facilities management' THEN 'Works and Logistics'
        WHEN LOWER(r.department) = 'training and capacity building' THEN 'Human Resources Management'
        ELSE r.department
    END
)
AND ou.is_active = TRUE
AND ou.is_assignable = TRUE
AND (
    r.unit_id IS NULL
    OR r.unit_id IS DISTINCT FROM ou.unit_id
    OR r.department IS DISTINCT FROM ou.unit_name
);

\ir ../stored_procedures/RegisterInternalUser_SP.sql
\ir ../stored_procedures/CreateRequisition_SP.sql
\ir ../stored_procedures/UpdateRequisition_SP.sql
\ir ../stored_procedures/GetRequisitions_SP.sql
\ir ../stored_procedures/GetRequisitionDetails_SP.sql

COMMIT;


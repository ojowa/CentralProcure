-- Migration 124: identity.roles.role_key becomes the single source of truth
-- for role identity across code and workflow tables. The column is backfilled
-- from the canonical key each display role maps to (same mapping that was
-- previously hardcoded in role-canonical.ts / ROLE_ALIASES). New roles with no
-- explicit mapping get an auto-generated snake_case key.
BEGIN;

-- Helper: normalize a display role name to a stable snake_case key.
CREATE OR REPLACE FUNCTION identity.derive_role_key(p_role_name text)
RETURNS text
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT lower(
        regexp_replace(
            regexp_replace(p_role_name, '\s+', '_', 'g'),
            '([a-z0-9])([A-Z])', '\1_\2', 'g'
        )
    );
$$;

-- Add the canonical role_key column (nullable until backfilled).
ALTER TABLE identity.roles
    ADD COLUMN IF NOT EXISTS role_key VARCHAR(100);

-- Backfill role_key for existing role names using the canonical mapping,
-- defaulting to the derived snake_case key for unmapped/new roles.
UPDATE identity.roles r
SET role_key = COALESCE(
    NULLIF(
        CASE r.role_name
            WHEN 'Admin' THEN 'admin'
            WHEN 'AuditOfficer' THEN 'audit_oversight'
            WHEN 'BPPLiaison' THEN 'bpp_liaison'
            WHEN 'BPPReviewer' THEN 'bpp_reviewer'
            WHEN 'CGIS' THEN 'accounting_officer'
            WHEN 'ComplaintsReviewOfficer' THEN 'complaints_review_officer'
            WHEN 'ContractManager' THEN 'contract_manager'
            WHEN 'DepartmentHead' THEN 'department_head'
            WHEN 'FinancialEvaluator' THEN 'financial_evaluator'
            WHEN 'FinancialUnitOfficer' THEN 'financial_unit_officer'
            WHEN 'FormationHead' THEN 'formation_head'
            WHEN 'FormationOfficer' THEN 'formation_officer'
            WHEN 'Head of Procurement' THEN 'comptroller_procurement'
            WHEN 'InspectionOfficer' THEN 'inspection_officer'
            WHEN 'LegalReviewer' THEN 'legal_reviewer'
            WHEN 'PaymentOfficer' THEN 'payment_officer'
            WHEN 'PlanningStatisticsOfficer' THEN 'planning_statistics_officer'
            WHEN 'ProcurementManager' THEN 'procurement_manager'
            WHEN 'ProcurementSecretary' THEN 'procurement_secretary'
            WHEN 'SystemAdministrator' THEN 'ict_admin'
            WHEN 'TechnicalEvaluator' THEN 'technical_evaluator'
            WHEN 'TendersBoardMember' THEN 'tenders_board'
            WHEN 'TendersBoardSecretary' THEN 'tenders_board_secretary'
            ELSE NULL
        END,
        ''
    ),
    identity.derive_role_key(r.role_name)
)
WHERE r.role_key IS NULL;

-- Enforce uniqueness and non-null now that every role has a key.
ALTER TABLE identity.roles
    ALTER COLUMN role_key SET NOT NULL;

ALTER TABLE identity.roles
    ADD CONSTRAINT roles_role_key_key UNIQUE (role_key);

COMMIT;
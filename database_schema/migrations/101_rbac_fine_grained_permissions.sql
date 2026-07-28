-- Migration 101: Fine-Grained RBAC Permissions System
-- Creates permissions table, role_permissions junction, and seeds from existing module actions
BEGIN;

-- ============================================================
-- 1. PERMISSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS identity.permissions (
    permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_key VARCHAR(150) UNIQUE NOT NULL,
    module VARCHAR(80) NOT NULL,
    action VARCHAR(80) NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (module, action)
);

-- ============================================================
-- 2. ROLE-PERMISSIONS JUNCTION TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS identity.role_permissions (
    role_permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES identity.roles(role_id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES identity.permissions(permission_id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON identity.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON identity.role_permissions(permission_id);

-- ============================================================
-- 3. SEED PERMISSIONS
-- ============================================================
INSERT INTO identity.permissions (permission_key, module, action, description) VALUES
    ('requisition.create',          'requisition',          'create',          'Create new requisitions'),
    ('requisition.update',          'requisition',          'update',          'Update existing requisitions'),
    ('requisition.view',            'requisition',          'view',            'View requisitions'),
    ('requisition.view.all',        'requisition',          'view.all',        'View all requisitions globally'),
    ('requisition.track',           'requisition',          'track',           'Track requisition progress'),
    ('requisition.delete',          'requisition',          'delete',          'Delete requisitions'),
    ('requisition.endorse',         'requisition',          'endorse',         'Endorse requisitions'),
    ('requisition.return',          'requisition',          'return',          'Return requisitions'),
    ('requisition.reject',          'requisition',          'reject',          'Reject requisitions'),
    ('budget.view',                 'budget',               'view',            'View budget data'),
    ('budget.confirm',              'budget',               'confirm',         'Confirm budget allocation'),
    ('planning_committee.view',     'planning_committee',   'view',            'View planning committee items'),
    ('planning_committee.review',   'planning_committee',   'review',          'Review in planning committee'),
    ('needs.create',                'needs',                'create',          'Create needs assessments'),
    ('needs.view',                  'needs',                'view',            'View needs assessments'),
    ('needs.endorse',               'needs',                'endorse',         'Endorse needs assessments'),
    ('needs.consolidate',           'needs',                'consolidate',     'Consolidate needs'),
    ('procurement_plan.manage',     'procurement_plan',     'manage',          'Manage procurement plans'),
    ('procurement_plan.approve',    'procurement_plan',     'approve',         'Approve procurement plans'),
    ('method.determine',            'method',               'determine',       'Determine procurement method'),
    ('tender.manage',               'tender',               'manage',          'Manage tenders'),
    ('tender.publish',              'tender',               'publish',         'Publish tenders'),
    ('bid_opening.manage',          'bid_opening',          'manage',          'Manage bid opening sessions'),
    ('bid_opening.view_detail',     'bid_opening',          'view_detail',     'View bid opening details'),
    ('bid_opening.financial_view',  'bid_opening',          'financial_view',  'Financial view of bids'),
    ('evaluation.actions',          'evaluation',           'actions',         'Perform evaluation actions'),
    ('evaluation.technical.score',  'evaluation',           'technical.score', 'Technical scoring'),
    ('evaluation.financial.score',  'evaluation',           'financial.score', 'Financial scoring'),
    ('evaluation_report.view',      'evaluation_report',    'view',            'View evaluation reports'),
    ('approval.review',             'approval',             'review',          'Review for approval'),
    ('approval.decide',             'approval',             'decide',          'Make approval decision'),
    ('cgis.approve',                'cgis',                 'approve',         'CGIS direct approval'),
    ('cgis.reject',                 'cgis',                 'reject',          'CGIS rejection'),
    ('cgis.return',                 'cgis',                 'return',          'CGIS return'),
    ('cgis.escalate',               'cgis',                 'escalate',        'CGIS escalation'),
    ('high_value_tenders.review',   'high_value_tenders',   'review',          'Review high-value tenders'),
    ('bpp.create',                  'bpp',                  'create',          'Create BPP escalation'),
    ('bpp.review',                  'bpp',                  'review',          'Review BPP submission'),
    ('bpp.decide',                  'bpp',                  'decide',          'BPP decision'),
    ('administrative_review.create',    'administrative_review', 'create',      'File complaints'),
    ('administrative_review.view',      'administrative_review', 'view',        'View administrative reviews'),
    ('administrative_review.update',    'administrative_review', 'update',      'Update administrative reviews'),
    ('administrative_review.resolve',   'administrative_review', 'resolve',     'Resolve administrative reviews'),
    ('contract_award.publish',      'contract_award',       'publish',         'Publish contract award'),
    ('contract_award.view',         'contract_award',       'view',            'View contract award'),
    ('contract_management.manage',  'contract_management',  'manage',          'Manage contracts'),
    ('inspection.view',             'inspection',           'view',            'View inspections'),
    ('inspection.update',           'inspection',           'update',          'Update inspections'),
    ('payment_tracking.view',       'payment_tracking',     'view',            'View payment tracking'),
    ('payment.record',              'payment',              'record',          'Record payment'),
    ('closeout.create',             'closeout',             'create',          'Create closeout'),
    ('audit_dashboard.view',        'audit_dashboard',      'view',            'View audit dashboard'),
    ('audit_trail.view',            'audit_trail',          'view',            'View audit trail'),
    ('compliance_reports.view',     'compliance_reports',   'view',            'View compliance reports'),
    ('threshold.view',              'threshold',            'view',            'View thresholds'),
    ('threshold.edit',              'threshold',            'edit',            'Edit thresholds'),
    ('threshold.configure',         'threshold',            'configure',       'Configure thresholds'),
    ('threshold.resolve',           'threshold',            'resolve',         'Resolve threshold route'),
    ('admin.manage_roles',          'admin',                'manage_roles',    'Manage users and roles'),
    ('admin.vendor_approval',       'admin',                'vendor_approval', 'Approve vendor registrations'),
    ('admin.manage_workflows',      'admin',                'manage_workflows','Configure workflow routes'),
    ('admin.monitor',               'admin',                'monitor',         'System monitoring'),
    ('profile.view',                'profile',              'view',            'View user profile'),
    ('profile.update',              'profile',              'update',          'Update user profile'),
    ('workflow_blueprint.view',     'workflow_blueprint',   'view',            'View workflow blueprint')
ON CONFLICT (permission_key) DO NOTHING;

-- ============================================================
-- 4. SEED ROLE-PERMISSION MAPPINGS
-- ============================================================

-- 4a. Admin (full access)
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'Admin' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'requisition.create', 'requisition.update', 'requisition.view', 'requisition.view.all', 'requisition.track', 'requisition.delete', 'requisition.endorse', 'requisition.return', 'requisition.reject',
    'budget.view', 'budget.confirm',
    'planning_committee.view', 'planning_committee.review',
    'needs.create', 'needs.view', 'needs.endorse', 'needs.consolidate',
    'procurement_plan.manage', 'procurement_plan.approve',
    'method.determine',
    'tender.manage', 'tender.publish',
    'bid_opening.manage', 'bid_opening.view_detail', 'bid_opening.financial_view',
    'evaluation.actions', 'evaluation.technical.score', 'evaluation.financial.score', 'evaluation_report.view',
    'approval.review', 'approval.decide',
    'cgis.approve', 'cgis.reject', 'cgis.return', 'cgis.escalate', 'high_value_tenders.review',
    'bpp.create', 'bpp.review', 'bpp.decide',
    'administrative_review.create', 'administrative_review.view', 'administrative_review.update', 'administrative_review.resolve',
    'contract_award.publish', 'contract_award.view', 'contract_management.manage',
    'inspection.view', 'inspection.update',
    'payment_tracking.view', 'payment.record', 'closeout.create',
    'audit_dashboard.view', 'audit_trail.view', 'compliance_reports.view',
    'threshold.view', 'threshold.edit', 'threshold.configure', 'threshold.resolve',
    'admin.manage_roles', 'admin.vendor_approval', 'admin.manage_workflows', 'admin.monitor',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4b. ICT Admin / SystemAdministrator
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'SystemAdministrator' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'requisition.create', 'requisition.update', 'requisition.view', 'requisition.view.all', 'requisition.track', 'requisition.delete', 'requisition.endorse',
    'budget.view', 'budget.confirm',
    'planning_committee.view', 'planning_committee.review',
    'needs.create', 'needs.view', 'needs.endorse', 'needs.consolidate',
    'procurement_plan.manage', 'procurement_plan.approve',
    'method.determine',
    'tender.manage', 'tender.publish',
    'bid_opening.manage', 'bid_opening.view_detail', 'bid_opening.financial_view',
    'evaluation.actions', 'evaluation_report.view',
    'approval.review', 'approval.decide',
    'cgis.approve', 'cgis.reject', 'cgis.return', 'cgis.escalate', 'high_value_tenders.review',
    'bpp.create', 'bpp.review',
    'administrative_review.create', 'administrative_review.view', 'administrative_review.update', 'administrative_review.resolve',
    'contract_award.publish', 'contract_award.view', 'contract_management.manage',
    'inspection.view', 'inspection.update',
    'payment_tracking.view', 'closeout.create',
    'audit_dashboard.view', 'audit_trail.view', 'compliance_reports.view',
    'admin.manage_roles', 'admin.vendor_approval', 'admin.manage_workflows', 'admin.monitor',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4c. Comptroller Procurement (DB name: Head of Procurement)
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'Head of Procurement' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'requisition.create', 'requisition.update', 'requisition.view', 'requisition.view.all', 'requisition.track', 'requisition.endorse', 'requisition.return', 'requisition.reject',
    'planning_committee.view', 'planning_committee.review',
    'needs.create', 'needs.view', 'needs.endorse', 'needs.consolidate',
    'procurement_plan.manage', 'procurement_plan.approve',
    'method.determine',
    'tender.manage', 'tender.publish',
    'bid_opening.manage', 'bid_opening.view_detail',
    'evaluation.actions', 'evaluation_report.view',
    'approval.review', 'approval.decide',
    'bpp.create',
    'administrative_review.create', 'administrative_review.view',
    'contract_award.publish', 'contract_award.view', 'contract_management.manage',
    'inspection.view', 'inspection.update',
    'audit_dashboard.view', 'audit_trail.view',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4d. Requisitioning Officer
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'RequisitioningOfficer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'requisition.create', 'requisition.update', 'requisition.view', 'requisition.track',
    'needs.create', 'needs.view',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4e. Department Head
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'DepartmentHead' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'requisition.create', 'requisition.update', 'requisition.view', 'requisition.track', 'requisition.endorse', 'requisition.return',
    'planning_committee.view',
    'needs.create', 'needs.view', 'needs.endorse',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4f. Formation Head
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'FormationHead' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'needs.create', 'needs.view', 'needs.endorse', 'needs.consolidate',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4g. Formation Officer
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'FormationOfficer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'needs.create', 'needs.view',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4h. Financial Unit Officer
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'FinancialUnitOfficer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'budget.view', 'budget.confirm',
    'planning_committee.view', 'planning_committee.review',
    'evaluation.actions', 'evaluation.financial.score',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4i. Planning Statistics Officer
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'PlanningStatisticsOfficer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'planning_committee.view', 'planning_committee.review',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4j. Procurement Secretary
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'ProcurementSecretary' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'planning_committee.view', 'planning_committee.review',
    'procurement_plan.manage', 'procurement_plan.approve',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4k. Procurement Manager
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'ProcurementManager' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'tender.manage', 'tender.publish',
    'bid_opening.manage', 'bid_opening.view_detail',
    'contract_award.publish', 'contract_award.view', 'contract_management.manage',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4l. Legal Reviewer
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'LegalReviewer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'planning_committee.view', 'planning_committee.review',
    'method.determine',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4m. Technical Evaluator
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'TechnicalEvaluator' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'bid_opening.manage', 'bid_opening.view_detail',
    'evaluation.actions', 'evaluation.technical.score', 'evaluation_report.view',
    'administrative_review.create', 'administrative_review.view',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4n. Financial Evaluator
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'FinancialEvaluator' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'bid_opening.manage', 'bid_opening.view_detail', 'bid_opening.financial_view',
    'evaluation.actions', 'evaluation.financial.score', 'evaluation_report.view',
    'administrative_review.create', 'administrative_review.view',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4o. Evaluation Committee
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'EvaluationCommittee' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'bid_opening.manage', 'bid_opening.view_detail',
    'evaluation.actions', 'evaluation.technical.score', 'evaluation.financial.score', 'evaluation_report.view',
    'administrative_review.create', 'administrative_review.view',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4p. Tenders Board
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'TendersBoardMember' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'evaluation_report.view',
    'approval.review', 'approval.decide',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4q. Tenders Board Secretary
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'TendersBoardSecretary' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'evaluation_report.view',
    'approval.review', 'approval.decide',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4r. Accounting Officer / CGIS (DB name: CGIS)
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'CGIS' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'budget.view', 'budget.confirm',
    'procurement_plan.approve',
    'cgis.approve', 'cgis.reject', 'cgis.return', 'cgis.escalate', 'high_value_tenders.review',
    'bpp.create', 'bpp.review', 'bpp.decide',
    'administrative_review.create', 'administrative_review.view',
    'contract_award.view', 'contract_management.manage',
    'payment_tracking.view', 'payment.record', 'closeout.create',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4s. BPP Liaison
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'BPPLiaison' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'bpp.create', 'bpp.review',
    'audit_trail.view', 'compliance_reports.view',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4t. BPP Reviewer
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'BPPReviewer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'bpp.create', 'bpp.review',
    'administrative_review.view',
    'audit_trail.view', 'compliance_reports.view',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4u. Complaints Review Officer
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'ComplaintsReviewOfficer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'requisition.track',
    'administrative_review.create', 'administrative_review.view', 'administrative_review.update', 'administrative_review.resolve',
    'audit_dashboard.view', 'audit_trail.view', 'compliance_reports.view',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4v. Contract Manager
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'ContractManager' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'contract_award.publish', 'contract_award.view', 'contract_management.manage',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4w. Inspection Officer
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'InspectionOfficer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'inspection.view', 'inspection.update',
    'payment_tracking.view', 'closeout.create',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4x. Payment Officer
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'PaymentOfficer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'payment_tracking.view', 'payment.record', 'closeout.create',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4y. Audit Oversight
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_name = 'AuditOfficer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'requisition.track',
    'inspection.view',
    'payment_tracking.view',
    'administrative_review.view',
    'audit_dashboard.view', 'audit_trail.view', 'compliance_reports.view',
    'profile.view', 'profile.update',
    'workflow_blueprint.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================
-- 5. HELPER FUNCTION: Get permissions for a role
-- ============================================================
CREATE OR REPLACE FUNCTION identity.get_role_permissions(p_role_name VARCHAR)
RETURNS TABLE (
    permission_key VARCHAR,
    module VARCHAR,
    action VARCHAR,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.permission_key, p.module, p.action, p.description
    FROM identity.role_permissions rp
    JOIN identity.roles r ON r.role_id = rp.role_id
    JOIN identity.permissions p ON p.permission_id = rp.permission_id
    WHERE r.role_name = p_role_name
      AND r.is_active = TRUE
      AND p.is_active = TRUE
      AND rp.is_enabled = TRUE
    ORDER BY p.module, p.action;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 6. HELPER FUNCTION: Check if role has a specific permission
-- ============================================================
CREATE OR REPLACE FUNCTION identity.role_has_permission(p_role_name VARCHAR, p_permission_key VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM identity.role_permissions rp
        JOIN identity.roles r ON r.role_id = rp.role_id
        JOIN identity.permissions p ON p.permission_id = rp.permission_id
        WHERE r.role_name = p_role_name
          AND p.permission_key = p_permission_key
          AND r.is_active = TRUE
          AND p.is_active = TRUE
          AND rp.is_enabled = TRUE
    ) INTO v_exists;
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 7. VIEW: Permission summary for admin UI
-- ============================================================
CREATE OR REPLACE VIEW identity.v_role_permissions AS
SELECT
    r.role_name,
    r.description AS role_description,
    p.permission_key,
    p.module,
    p.action,
    p.description AS permission_description,
    rp.is_enabled,
    rp.created_at AS granted_at
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
JOIN identity.permissions p ON p.permission_id = rp.permission_id
WHERE r.is_active = TRUE AND p.is_active = TRUE
ORDER BY r.role_name, p.module, p.action;

COMMIT;

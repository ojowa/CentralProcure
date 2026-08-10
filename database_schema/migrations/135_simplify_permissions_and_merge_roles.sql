-- Migration 135: Simplify Permissions + Merge Roles
-- Deletes dead permissions, adds missing ones, merges 22 roles → 14
-- EXECUTION ORDER: roles first, then permissions, then re-seed
BEGIN;

-- ============================================================
-- PHASE 1: CREATE NEW MERGED ROLES + COPY GRANTS
-- ============================================================
-- Must happen BEFORE deleting old role grants

-- 1a. evaluator: merge technical_evaluator + financial_evaluator
INSERT INTO identity.roles (role_name, role_key, description, is_active)
VALUES ('Evaluator', 'evaluator', 'Performs technical and financial evaluation', TRUE)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
    (SELECT role_id FROM identity.roles WHERE role_key = 'evaluator'),
    rp.permission_id,
    rp.is_enabled
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'technical_evaluator'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
    (SELECT role_id FROM identity.roles WHERE role_key = 'evaluator'),
    rp.permission_id,
    rp.is_enabled
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'financial_evaluator'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 1b. board_member: merge tenders_board + tenders_board_secretary
INSERT INTO identity.roles (role_name, role_key, description, is_active)
VALUES ('Board Member', 'board_member', 'Reviews evaluation outcomes and approves/rejects', TRUE)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
    (SELECT role_id FROM identity.roles WHERE role_key = 'board_member'),
    rp.permission_id,
    rp.is_enabled
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'tenders_board'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
    (SELECT role_id FROM identity.roles WHERE role_key = 'board_member'),
    rp.permission_id,
    rp.is_enabled
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'tenders_board_secretary'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 1c. bpp_officer: merge bpp_liaison + bpp_reviewer
INSERT INTO identity.roles (role_name, role_key, description, is_active)
VALUES ('BPP Officer', 'bpp_officer', 'Manages BPP no-objection submissions and reviews', TRUE)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
    (SELECT role_id FROM identity.roles WHERE role_key = 'bpp_officer'),
    rp.permission_id,
    rp.is_enabled
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'bpp_liaison'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
    (SELECT role_id FROM identity.roles WHERE role_key = 'bpp_officer'),
    rp.permission_id,
    rp.is_enabled
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'bpp_reviewer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 1d. post_award_officer: merge contract_manager + inspection_officer + payment_officer
INSERT INTO identity.roles (role_name, role_key, description, is_active)
VALUES ('Post-Award Officer', 'post_award_officer', 'Manages contracts, inspections, and payments', TRUE)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
    (SELECT role_id FROM identity.roles WHERE role_key = 'post_award_officer'),
    rp.permission_id,
    rp.is_enabled
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'contract_manager'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
    (SELECT role_id FROM identity.roles WHERE role_key = 'post_award_officer'),
    rp.permission_id,
    rp.is_enabled
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'inspection_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
    (SELECT role_id FROM identity.roles WHERE role_key = 'post_award_officer'),
    rp.permission_id,
    rp.is_enabled
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'payment_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 1e. procurement_officer: merge procurement_manager + procurement_secretary
INSERT INTO identity.roles (role_name, role_key, description, is_active)
VALUES ('Procurement Officer', 'procurement_officer', 'Manages tenders and procurement operations', TRUE)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
    (SELECT role_id FROM identity.roles WHERE role_key = 'procurement_officer'),
    rp.permission_id,
    rp.is_enabled
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'procurement_manager'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
    (SELECT role_id FROM identity.roles WHERE role_key = 'procurement_officer'),
    rp.permission_id,
    rp.is_enabled
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'procurement_secretary'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 1f. planning_officer: merge planning_statistics_officer + financial_unit_officer
INSERT INTO identity.roles (role_name, role_key, description, is_active)
VALUES ('Planning Officer', 'planning_officer', 'Manages budget and planning committee', TRUE)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
    (SELECT role_id FROM identity.roles WHERE role_key = 'planning_officer'),
    rp.permission_id,
    rp.is_enabled
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'planning_statistics_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
    (SELECT role_id FROM identity.roles WHERE role_key = 'planning_officer'),
    rp.permission_id,
    rp.is_enabled
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'financial_unit_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 1g. compliance_officer: merge complaints_review_officer + legal_reviewer
INSERT INTO identity.roles (role_name, role_key, description, is_active)
VALUES ('Compliance Officer', 'compliance_officer', 'Handles complaints, legal review, and compliance', TRUE)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
    (SELECT role_id FROM identity.roles WHERE role_key = 'compliance_officer'),
    rp.permission_id,
    rp.is_enabled
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'complaints_review_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT
    (SELECT role_id FROM identity.roles WHERE role_key = 'compliance_officer'),
    rp.permission_id,
    rp.is_enabled
FROM identity.role_permissions rp
JOIN identity.roles r ON r.role_id = rp.role_id
WHERE r.role_key = 'legal_reviewer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 1h. Deactivate all old merged/legacy roles
UPDATE identity.roles SET is_active = FALSE WHERE role_key IN (
    'technical_evaluator', 'financial_evaluator',
    'tenders_board', 'tenders_board_secretary',
    'bpp_liaison', 'bpp_reviewer',
    'contract_manager', 'inspection_officer', 'payment_officer',
    'procurement_manager', 'procurement_secretary',
    'planning_statistics_officer', 'financial_unit_officer',
    'complaints_review_officer', 'legal_reviewer'
);

-- ============================================================
-- PHASE 2: DELETE DEAD ROLE-PERMISSION GRANTS
-- ============================================================
-- Remove grants for deactivated roles (cleanup)
DELETE FROM identity.role_permissions
WHERE role_id IN (
    SELECT role_id FROM identity.roles WHERE is_active = FALSE
);

-- ============================================================
-- PHASE 3: DELETE DEAD PERMISSIONS
-- ============================================================
-- Remove grants referencing dead permissions first
DELETE FROM identity.role_permissions WHERE permission_id IN (
    SELECT permission_id FROM identity.permissions WHERE permission_key IN (
        'requisition.create', 'requisition.update', 'requisition.view',
        'requisition.view.all', 'requisition.track', 'requisition.delete',
        'requisition.endorse', 'requisition.return', 'requisition.reject',
        'budget.view',
        'planning_committee.view',
        'tender.publish',
        'bid_opening.view_detail', 'bid_opening.financial_view',
        'evaluation.actions', 'evaluation.technical.score', 'evaluation.financial.score',
        'evaluation_report.view',
        'approval.review',
        'cgis.reject', 'cgis.return', 'cgis.escalate',
        'high_value_tenders.review',
        'bpp.review', 'bpp.decide',
        'administrative_review.resolve',
        'contract_award.view',
        'inspection.view',
        'payment_tracking.view',
        'closeout.create',
        'audit_dashboard.view', 'audit_trail.view',
        'compliance_reports.view',
        'threshold.view', 'threshold.edit', 'threshold.configure', 'threshold.resolve',
        'admin.manage_roles', 'admin.manage_workflows', 'admin.monitor',
        'profile.view', 'profile.update',
        'workflow_blueprint.view',
        'needs.export', 'needs.archive', 'needs.return'
    )
);

DELETE FROM identity.permissions WHERE permission_key IN (
    'requisition.create', 'requisition.update', 'requisition.view',
    'requisition.view.all', 'requisition.track', 'requisition.delete',
    'requisition.endorse', 'requisition.return', 'requisition.reject',
    'budget.view',
    'planning_committee.view',
    'tender.publish',
    'bid_opening.view_detail', 'bid_opening.financial_view',
    'evaluation.actions', 'evaluation.technical.score', 'evaluation.financial.score',
    'evaluation_report.view',
    'approval.review',
    'cgis.reject', 'cgis.return', 'cgis.escalate',
    'high_value_tenders.review',
    'bpp.review', 'bpp.decide',
    'administrative_review.resolve',
    'contract_award.view',
    'inspection.view',
    'payment_tracking.view',
    'closeout.create',
    'audit_dashboard.view', 'audit_trail.view',
    'compliance_reports.view',
    'threshold.view', 'threshold.edit', 'threshold.configure', 'threshold.resolve',
    'admin.manage_roles', 'admin.manage_workflows', 'admin.monitor',
    'profile.view', 'profile.update',
    'workflow_blueprint.view',
    'needs.export', 'needs.archive', 'needs.return'
);

-- ============================================================
-- PHASE 4: ADD MISSING PERMISSIONS
-- ============================================================
INSERT INTO identity.permissions (permission_key, module, action, description) VALUES
    ('admin.manage_thresholds',          'admin',                'manage_thresholds',    'Manage approval thresholds'),
    ('admin.manage_workflow_config',     'admin',                'manage_workflow_config','Configure workflow routes'),
    ('bid.submit',                       'bid',                  'submit',               'Submit bid'),
    ('audit.closeout',                   'audit',                'closeout',             'Audit closeout'),
    ('budget.appropriate',               'budget',               'appropriate',          'Appropriate budget allocation'),
    ('budget.release',                   'budget',               'release',              'Release budget'),
    ('budget.commit',                    'budget',               'commit',               'Commit budget'),
    ('bpp.update',                       'bpp',                  'update',               'Update BPP submission'),
    ('planning_committee.manage',        'planning_committee',   'manage',               'Manage planning committee'),
    ('method.exception_request',         'method',               'exception_request',    'Request procurement exception'),
    ('method.exception_approve',         'method',               'exception_approve',    'Approve procurement exception'),
    ('evaluation.submit',                'evaluation',           'submit',               'Submit evaluation'),
    ('evaluation.assign',                'evaluation',           'assign',               'Assign evaluation'),
    ('annual_plan.create',               'annual_plan',          'create',               'Create annual procurement plan'),
    ('annual_plan.update',               'annual_plan',          'update',               'Update annual procurement plan'),
    ('annual_plan.submit',               'annual_plan',          'submit',               'Submit annual procurement plan'),
    ('annual_plan.recommend',            'annual_plan',          'recommend',            'Recommend annual procurement plan'),
    ('workflow.advance',                 'workflow',             'advance',              'Advance workflow stage'),
    ('vendor.update',                    'vendor',               'update',               'Update vendor registration'),
    ('vendor.compliance_upload',         'vendor',               'compliance_upload',    'Upload vendor compliance docs'),
    ('administrative_review.view',       'administrative_review', 'view',                'View administrative reviews')
ON CONFLICT (permission_key) DO NOTHING;

-- ============================================================
-- PHASE 5: SEED PERMISSIONS FOR 14 ACTIVE ROLES (clean slate)
-- ============================================================
DELETE FROM identity.role_permissions
WHERE role_id IN (SELECT role_id FROM identity.roles WHERE is_active = TRUE);

-- Admin: full access to all active permissions
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_key = 'admin' AND r.is_active = TRUE AND p.is_active = TRUE
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Head of Procurement: broad procurement access
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_key = 'comptroller_procurement' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'needs.create', 'needs.view', 'needs.submit', 'needs.endorse', 'needs.delete', 'needs.consolidate', 'needs.carry_forward', 'needs.analysis',
    'budget.confirm', 'budget.appropriate', 'budget.release', 'budget.commit',
    'planning_committee.review', 'planning_committee.manage',
    'procurement_plan.manage', 'procurement_plan.approve',
    'method.determine', 'method.exception_request', 'method.exception_approve',
    'tender.manage',
    'bid_opening.manage',
    'evaluation.submit', 'evaluation.assign',
    'approval.decide',
    'bpp.create', 'bpp.update',
    'administrative_review.create', 'administrative_review.update',
    'contract_award.publish', 'contract_management.manage',
    'inspection.update',
    'payment.record',
    'audit.closeout',
    'annual_plan.create', 'annual_plan.update', 'annual_plan.submit', 'annual_plan.recommend',
    'workflow.advance'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Department Head: needs endorsement + department planning
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_key = 'department_head' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'needs.create', 'needs.view', 'needs.submit', 'needs.endorse', 'needs.delete',
    'planning_committee.review',
    'annual_plan.create', 'annual_plan.update', 'annual_plan.submit',
    'workflow.advance'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Formation Head: needs endorsement at formation level
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_key = 'formation_head' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'needs.create', 'needs.view', 'needs.submit', 'needs.endorse', 'needs.delete', 'needs.consolidate', 'needs.carry_forward',
    'workflow.advance'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Formation Officer: needs submission at formation level
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_key = 'formation_officer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'needs.create', 'needs.view', 'needs.submit',
    'workflow.advance'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- CGIS: approval authority
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_key = 'accounting_officer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'budget.confirm', 'budget.appropriate', 'budget.release', 'budget.commit',
    'procurement_plan.approve',
    'cgis.approve',
    'bpp.create', 'bpp.update',
    'administrative_review.create', 'administrative_review.update', 'administrative_review.view',
    'contract_award.publish', 'contract_management.manage',
    'payment.record',
    'annual_plan.recommend',
    'workflow.advance'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Audit Officer: read-only audit access
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_key = 'audit_oversight' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'administrative_review.view',
    'audit.closeout',
    'workflow.advance'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Evaluator: technical + financial evaluation
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_key = 'evaluator' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'bid_opening.manage',
    'evaluation.submit', 'evaluation.assign',
    'administrative_review.create', 'administrative_review.update',
    'workflow.advance'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Board Member: board review + approval
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_key = 'board_member' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'approval.decide',
    'workflow.advance'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- BPP Officer: BPP no-objection
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_key = 'bpp_officer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'bpp.create', 'bpp.update',
    'administrative_review.create', 'administrative_review.update',
    'audit.closeout',
    'workflow.advance'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Post-Award Officer: contract, inspection, payment
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_key = 'post_award_officer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'contract_award.publish', 'contract_management.manage',
    'inspection.update',
    'payment.record',
    'audit.closeout',
    'workflow.advance'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Procurement Officer: tender management
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_key = 'procurement_officer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'tender.manage',
    'bid_opening.manage',
    'evaluation.submit', 'evaluation.assign',
    'workflow.advance'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Planning Officer: budget + planning committee
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_key = 'planning_officer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'budget.confirm',
    'planning_committee.review', 'planning_committee.manage',
    'annual_plan.create', 'annual_plan.update', 'annual_plan.submit',
    'workflow.advance'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Compliance Officer: complaints + legal review
INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
SELECT r.role_id, p.permission_id, TRUE
FROM identity.roles r, identity.permissions p
WHERE r.role_key = 'compliance_officer' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.permission_key IN (
    'administrative_review.create', 'administrative_review.view', 'administrative_review.update',
    'method.determine', 'method.exception_request', 'method.exception_approve',
    'audit.closeout',
    'workflow.advance'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================
-- PHASE 6: UPDATE INTERNAL MODULES CATALOG
-- ============================================================
UPDATE identity.internal_modules
SET actions = ARRAY['needs.create', 'needs.view', 'needs.view.all', 'needs.submit', 'needs.endorse', 'needs.delete', 'needs.consolidate', 'needs.carry_forward', 'needs.analysis']
WHERE module_id = 'needs-collection';

UPDATE identity.internal_modules
SET actions = ARRAY['needs.create', 'needs.view', 'needs.submit', 'needs.endorse', 'needs.delete']
WHERE module_id = 'needs-submission';

-- ============================================================
-- PHASE 7: DROP LEGACY VIEW
-- ============================================================
DROP VIEW IF EXISTS identity.v_role_permissions;

COMMIT;
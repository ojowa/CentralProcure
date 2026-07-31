-- Migration 122: Add missing modules that have frontend renderers but no DB catalog entry
BEGIN;

INSERT INTO identity.internal_modules (module_id, title, section, description, microservice, control_purpose, actions, is_active)
VALUES
    ('tenders-board-approval', 'Tenders Board Approval', 'Governance & Approval', 'Review committee outputs and exceptions for the NIS Tenders Board.', 'Approval Workflow Service', 'Threshold-based approval governance.', ARRAY['approval.review'], TRUE),
    ('final-approval', 'Final Approval', 'CGIS', 'Final CGIS approval checkpoint before procurement proceeds.', 'Approval Workflow Service', 'CGIS authority for high-value spend.', ARRAY['high_value_tenders.review'], TRUE),
    ('department-head-review', 'Department Head Review', 'Requisitions', 'Review and endorse departmental requisitions.', 'Requisition Service', 'Departmental endorsement control.', ARRAY['requisition.endorse', 'requisition.view'], TRUE),
    ('threshold-configuration', 'Threshold Configuration', 'System Administration', 'Configure approval thresholds and routing rules.', 'Workflow Orchestration Service', 'Policy enforcement for approval routing.', ARRAY['admin.manage_thresholds'], TRUE),
    ('organization-management', 'Organization Management', 'System Administration', 'Manage organizational units, formations, and departments.', 'Identity Service', 'Ensure structural integrity of organizational units.', ARRAY['admin.manage_org'], TRUE)
ON CONFLICT (module_id) DO UPDATE
SET title = EXCLUDED.title,
    section = EXCLUDED.section,
    description = EXCLUDED.description,
    microservice = EXCLUDED.microservice,
    control_purpose = EXCLUDED.control_purpose,
    actions = EXCLUDED.actions,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

COMMIT;

-- Seed internal roles (PostgreSQL)
-- role_key is the single source of truth used across the app and workflow
-- tables; role_name is the display label.
-- Migration 135 consolidated 22 roles → 14 active roles.
INSERT INTO identity.roles (role_name, role_key, description)
VALUES
    ('Admin', 'admin', 'System administrator'),
    ('Head of Procurement', 'comptroller_procurement', 'Leads procurement, approves APP, chairs planning committee'),
    ('DepartmentHead', 'department_head', 'Reviews and endorses departmental procurement needs'),
    ('FormationHead', 'formation_head', 'Head of the NIS formation responsible for endorsing needs'),
    ('FormationOfficer', 'formation_officer', 'Officer responsible for procurement needs at the formation level'),
    ('CGIS', 'accounting_officer', 'Comptroller General approval authority'),
    ('AuditOfficer', 'audit_oversight', 'Read-only audit and compliance access'),
    ('Evaluator', 'evaluator', 'Performs technical and financial evaluation'),
    ('Board Member', 'board_member', 'Reviews evaluation outcomes and approves/rejects'),
    ('BPP Officer', 'bpp_officer', 'Manages BPP no-objection submissions and reviews'),
    ('Post-Award Officer', 'post_award_officer', 'Manages contracts, inspections, and payments'),
    ('Procurement Officer', 'procurement_officer', 'Manages tenders and procurement operations'),
    ('Planning Officer', 'planning_officer', 'Manages budget and planning committee'),
    ('Compliance Officer', 'compliance_officer', 'Handles complaints, legal review, and compliance')
ON CONFLICT (role_name) DO NOTHING;

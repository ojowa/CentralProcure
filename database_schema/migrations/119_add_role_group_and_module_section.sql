-- ============================================================================
-- Migration 119: Add group column to roles and internal_modules
-- ============================================================================
-- Organizes users into three groups:
--   1. 'vendor'            — External suppliers
--   2. 'office_formation'  — Needs submission (formations, departments)
--   3. 'procurement_staff' — Procurement operations staff
--
-- Also adds a sub_section column to internal_modules for sidebar grouping.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────
-- 1. Add group column to roles
-- ─────────────────────────────────────────────
ALTER TABLE identity.roles
    ADD COLUMN IF NOT EXISTS "group" VARCHAR(30) NOT NULL DEFAULT 'procurement_staff';

-- Seed role groups
UPDATE identity.roles SET "group" = 'vendor'
    WHERE role_name = 'Vendor';

UPDATE identity.roles SET "group" = 'office_formation'
    WHERE role_name IN ('FormationOfficer', 'FormationHead', 'RequisitioningOfficer', 'DepartmentHead');

UPDATE identity.roles SET "group" = 'procurement_staff'
    WHERE role_name NOT IN ('Vendor', 'FormationOfficer', 'FormationHead', 'RequisitioningOfficer', 'DepartmentHead')
      AND "group" = 'procurement_staff'; -- already default, but explicit

-- ─────────────────────────────────────────────
-- 2. Add group + sub_section columns to modules
-- ─────────────────────────────────────────────
ALTER TABLE identity.internal_modules
    ADD COLUMN IF NOT EXISTS "group" VARCHAR(30) NOT NULL DEFAULT 'procurement_staff';

ALTER TABLE identity.internal_modules
    ADD COLUMN IF NOT EXISTS sub_section VARCHAR(80) NULL;

-- ─────────────────────────────────────────────
-- 3. Seed module groups and sub-sections
-- ─────────────────────────────────────────────

-- Group 2: Offices & Formations
UPDATE identity.internal_modules SET "group" = 'office_formation', sub_section = 'Needs Collection'
    WHERE module_id = 'needs-collection';

UPDATE identity.internal_modules SET "group" = 'office_formation', sub_section = 'Requisitions'
    WHERE module_id IN ('create-requisition', 'requisition-history', 'requisition-tracking');

UPDATE identity.internal_modules SET "group" = 'office_formation', sub_section = 'Requisitions'
    WHERE module_id = 'department-head-review';

-- Group 3: Procurement Staff — Planning & Budget
UPDATE identity.internal_modules SET "group" = 'procurement_staff', sub_section = 'Planning & Budget'
    WHERE module_id IN ('annual-procurement-plan', 'procurement-planning-committee', 'budget-workspace');

-- Group 3: Procurement Staff — Tendering & Sourcing
UPDATE identity.internal_modules SET "group" = 'procurement_staff', sub_section = 'Tendering & Sourcing'
    WHERE module_id IN ('create-tender', 'bid-opening-session', 'procurement-method-determination');

-- Group 3: Procurement Staff — Evaluation
UPDATE identity.internal_modules SET "group" = 'procurement_staff', sub_section = 'Evaluation'
    WHERE module_id IN ('assigned-tenders', 'technical-evaluation', 'financial-evaluation', 'evaluation-report');

-- Group 3: Procurement Staff — Governance & Approval
UPDATE identity.internal_modules SET "group" = 'procurement_staff', sub_section = 'Governance & Approval'
    WHERE module_id IN ('tender-review', 'approval-rejection', 'tenders-board-approval', 'cgis-approval', 'high-value-tenders');

-- Group 3: Procurement Staff — Post-Award
UPDATE identity.internal_modules SET "group" = 'procurement_staff', sub_section = 'Post-Award'
    WHERE module_id IN ('contract-award', 'contract-management', 'inspection-acceptance', 'payment-tracking');

-- Group 3: Procurement Staff — Oversight
UPDATE identity.internal_modules SET "group" = 'procurement_staff', sub_section = 'Oversight'
    WHERE module_id IN ('bpp-escalation', 'administrative-review', 'audit-dashboard', 'audit-trail-viewer', 'compliance-reports');

-- Group 3: Procurement Staff — System Administration
UPDATE identity.internal_modules SET "group" = 'procurement_staff', sub_section = 'System Administration'
    WHERE module_id IN ('user-role-management', 'vendor-registration-approval', 'workflow-configuration', 'threshold-configuration', 'system-monitoring');

-- Group 3: Procurement Staff — Needs & Requisitions (combined module for procurement staff view)
UPDATE identity.internal_modules SET "group" = 'procurement_staff', sub_section = 'Needs & Requisitions'
    WHERE module_id IN ('needs-collection', 'requisition-management');

-- Account / Profile
UPDATE identity.internal_modules SET "group" = 'procurement_staff', sub_section = 'Account'
    WHERE module_id = 'user-profile';

-- Workflow Blueprint (visible to all staff)
UPDATE identity.internal_modules SET "group" = 'procurement_staff', sub_section = NULL
    WHERE module_id = 'workflow-blueprint';

COMMIT;

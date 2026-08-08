-- Migration 123: Drop the requisition system end-to-end
-- Drops requisition tables, requisition FK columns on surviving tables,
-- requisition-related procedures, the RequisitioningOfficer role and its
-- assignments, requisition.* permissions, and unassigns the needs_collection
-- workflow stage (leaving the stage in place with no owner role).
BEGIN;

-- ============================================================
-- 1. DROP FK CONSTRAINTS THAT REFERENCE procurement_workflow.requisitions
-- ============================================================
ALTER TABLE procurement_workflow.requisition_line_items
    DROP CONSTRAINT IF EXISTS requisition_line_items_requisition_id_fkey;

ALTER TABLE vendor_sourcing.tenders
    DROP CONSTRAINT IF EXISTS tenders_requisition_fk;

ALTER TABLE procurement_workflow.bpp_no_objections
    DROP CONSTRAINT IF EXISTS bpp_no_objections_requisition_id_fkey;

ALTER TABLE procurement_workflow.budget_commitments
    DROP CONSTRAINT IF EXISTS budget_commitments_requisition_id_fkey;

ALTER TABLE procurement_workflow.planning_committee_member_reviews
    DROP CONSTRAINT IF EXISTS fk_member_review_requisition;

ALTER TABLE procurement_workflow.planning_committee_member_status
    DROP CONSTRAINT IF EXISTS fk_member_status_requisition;

ALTER TABLE procurement_workflow.requisition_app_unlinks
    DROP CONSTRAINT IF EXISTS requisition_app_unlinks_requisition_id_fkey;

-- ============================================================
-- 2. DROP CHECK CONSTRAINTS THAT MENTION REQUISITION_ID
-- ============================================================
ALTER TABLE procurement_workflow.budget_commitments
    DROP CONSTRAINT IF EXISTS budget_commitments_source_chk;

ALTER TABLE procurement_workflow.bpp_no_objections
    DROP CONSTRAINT IF EXISTS bpp_no_objections_source_chk;

-- ============================================================
-- 3. DROP REQUISITION_ID UNIQUE CONSTRAINTS / INDEXES FIRST
-- ============================================================
DROP INDEX IF EXISTS vendor_sourcing.ux_tenders_requisition_id;
DROP INDEX IF EXISTS procurement_workflow.bpp_no_objections_requisition_idx;
DROP INDEX IF EXISTS procurement_workflow.idx_member_review_requisition;
DROP INDEX IF EXISTS procurement_workflow.idx_member_status_requisition;

ALTER TABLE procurement_workflow.planning_committee_member_reviews
    DROP CONSTRAINT IF EXISTS uq_member_review_req_role_user_round;
ALTER TABLE procurement_workflow.planning_committee_member_reviews
    DROP CONSTRAINT IF EXISTS uq_member_review_req_role_user;

ALTER TABLE procurement_workflow.planning_committee_member_status
    DROP CONSTRAINT IF EXISTS uq_member_status_req_role;

ALTER TABLE procurement_workflow.planning_committee_decisions
    DROP CONSTRAINT IF EXISTS uq_planning_committee_decisions_requisition;

-- ============================================================
-- 4. DROP REQUISITION_ID COLUMNS FROM SURVIVING TABLES
-- ============================================================
ALTER TABLE vendor_sourcing.tenders
    DROP COLUMN IF EXISTS requisition_id;

ALTER TABLE procurement_workflow.bpp_no_objections
    DROP COLUMN IF EXISTS requisition_id;

ALTER TABLE procurement_workflow.budget_commitments
    DROP COLUMN IF EXISTS requisition_id;

ALTER TABLE procurement_workflow.planning_committee_member_reviews
    DROP COLUMN IF EXISTS requisition_id;

ALTER TABLE procurement_workflow.planning_committee_member_status
    DROP COLUMN IF EXISTS requisition_id;

ALTER TABLE procurement_workflow.planning_committee_decisions
    DROP COLUMN IF EXISTS requisition_id;

-- ============================================================
-- 5. DROP REQUISITION-ONLY TABLES
-- ============================================================
DROP TABLE IF EXISTS procurement_workflow.planning_committee_plan_links CASCADE;
DROP TABLE IF EXISTS procurement_workflow.requisition_app_unlinks CASCADE;
DROP TABLE IF EXISTS procurement_workflow.requisition_line_items CASCADE;
DROP TABLE IF EXISTS procurement_workflow.requisition_items CASCADE;
DROP TABLE IF EXISTS procurement_workflow.plan_requisitions CASCADE;
DROP TABLE IF EXISTS procurement_workflow.planning_committee_reviews CASCADE;
DROP TABLE IF EXISTS procurement_workflow.committee_decisions CASCADE;
DROP TABLE IF EXISTS procurement_workflow.plan_committee_plan_links CASCADE;
DROP TABLE IF EXISTS procurement_workflow.requisitions CASCADE;

-- ============================================================
-- 6. DROP REQUISITION-RELATED PROCEDURES/FUNCTIONS
-- ============================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT
            n.nspname AS schema_name,
            p.proname AS fname,
            pg_get_function_identity_arguments(p.oid) AS fargs,
            CASE p.prokind WHEN 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END AS kind
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname IN ('procurement_workflow', 'vendor_sourcing')
          AND (
              p.proname ILIKE '%requisition%'
              OR p.proname = 'require_bpp_no_objection'
              OR p.proname = 'require_requisition_app_item'
          )
    LOOP
        EXECUTE format('DROP %s IF EXISTS %I.%I(%s) CASCADE',
            r.kind, r.schema_name, r.fname, r.fargs);
    END LOOP;
END
$$;

-- ============================================================
-- 7. REMOVE THE REQUISITIONING OFFICER ROLE AND ITS ASSIGNMENTS
-- ============================================================
DO $$
DECLARE
    v_role_id UUID;
BEGIN
    SELECT role_id INTO v_role_id
    FROM identity.roles
    WHERE role_name = 'RequisitioningOfficer';

    IF v_role_id IS NOT NULL THEN
        DELETE FROM identity.user_role_audit
        WHERE new_role_id = v_role_id
           OR previous_role_id = v_role_id;

        DELETE FROM identity.internal_users
        WHERE role_id = v_role_id;

        DELETE FROM identity.internal_module_grants
        WHERE role_id = v_role_id;

        DELETE FROM identity.roles
        WHERE role_id = v_role_id;
    END IF;
END
$$;

-- ============================================================
-- 8. REMOVE REQUIREMENT.* PERMISSIONS
-- ============================================================
DELETE FROM identity.role_permissions
WHERE permission_id IN (
    SELECT permission_id
    FROM identity.permissions
    WHERE permission_key LIKE 'requisition.%'
);

DELETE FROM identity.permissions
WHERE permission_key LIKE 'requisition.%';

-- ============================================================
-- 9. UNASSIGN THE NEEDS_COLLECTION STAGE (role removed, stage stays)
-- ============================================================
DELETE FROM procurement_workflow.workflow_role_tasks
WHERE role_key = 'requisitioning_officer';

UPDATE procurement_workflow.workflow_stage_catalog
SET primary_owner_role = NULL
WHERE primary_owner_role = 'requisitioning_officer';

COMMIT;
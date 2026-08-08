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

ALTER TABLE procurement_workflow.planning_committee_decisions
    DROP CONSTRAINT IF EXISTS fk_committee_decision_requisition;

ALTER TABLE procurement_workflow.planning_committee_plan_links
    DROP CONSTRAINT IF EXISTS planning_committee_plan_links_requisition_id_fkey;

ALTER TABLE procurement_workflow.requisition_approval_tasks
    DROP CONSTRAINT IF EXISTS requisition_approval_tasks_requisition_id_fkey;

ALTER TABLE procurement_workflow.requisition_audit_events
    DROP CONSTRAINT IF EXISTS requisition_audit_events_requisition_id_fkey;

ALTER TABLE procurement_workflow.requisitions
    DROP CONSTRAINT IF EXISTS requisitions_app_item_fk;

ALTER TABLE procurement_workflow.requisitions
    DROP CONSTRAINT IF EXISTS requisitions_unit_id_fkey;

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
DROP INDEX IF EXISTS procurement_workflow.budget_commitments_requisition_active_ux;
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
-- 5. RESTORE PLAN-BASED UNIQUE CONSTRAINTS ON COMMITTEE TABLES
-- ============================================================
-- Deduplicate first: the pre-migration granularity was per-requisition,
-- so keep the latest row per plan-level key before adding the uniques.
DELETE FROM procurement_workflow.planning_committee_member_reviews a
USING procurement_workflow.planning_committee_member_reviews b
WHERE a.review_id <> b.review_id
  AND a.review_round = b.review_round
  AND a.plan_id = b.plan_id
  AND a.reviewer_role = b.reviewer_role
  AND a.reviewer_user_id = b.reviewer_user_id
  AND a.created_at < b.created_at;

DELETE FROM procurement_workflow.planning_committee_member_status a
USING procurement_workflow.planning_committee_member_status b
WHERE a.plan_id = b.plan_id
  AND a.role_key = b.role_key
  AND a.updated_at < b.updated_at;

DELETE FROM procurement_workflow.planning_committee_decisions a
USING procurement_workflow.planning_committee_decisions b
WHERE a.plan_id = b.plan_id
  AND a.created_at < b.created_at;

ALTER TABLE procurement_workflow.planning_committee_member_reviews
    ADD CONSTRAINT uq_member_review_plan_role_user_round
        UNIQUE (plan_id, reviewer_role, reviewer_user_id, review_round);

ALTER TABLE procurement_workflow.planning_committee_member_status
    ADD CONSTRAINT uq_member_status_plan_role
        UNIQUE (plan_id, role_key);

ALTER TABLE procurement_workflow.planning_committee_decisions
    ADD CONSTRAINT uq_planning_committee_decisions_plan
        UNIQUE (plan_id);

-- ============================================================
-- 6. DROP REQUISITION-ONLY TABLES
-- ============================================================
DROP TABLE IF EXISTS procurement_workflow.planning_committee_plan_links CASCADE;
DROP TABLE IF EXISTS procurement_workflow.requisition_app_unlinks CASCADE;
DROP TABLE IF EXISTS procurement_workflow.requisition_line_items CASCADE;
DROP TABLE IF EXISTS procurement_workflow.requisition_items CASCADE;
DROP TABLE IF EXISTS procurement_workflow.plan_requisitions CASCADE;
DROP TABLE IF EXISTS procurement_workflow.planning_committee_reviews CASCADE;
DROP TABLE IF EXISTS procurement_workflow.committee_decisions CASCADE;
DROP TABLE IF EXISTS procurement_workflow.plan_committee_plan_links CASCADE;
DROP TABLE IF EXISTS procurement_workflow.requisition_approval_tasks CASCADE;
DROP TABLE IF EXISTS procurement_workflow.requisition_audit_events CASCADE;
DROP TABLE IF EXISTS procurement_workflow.internal_requisitions CASCADE;
DROP TABLE IF EXISTS procurement_workflow.requisitions CASCADE;

-- ============================================================
-- 7. DROP REQUISITION-RELATED PROCEDURES/FUNCTIONS
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
              OR (
                  p.proname IN (
                      'get_member_reviews', 'get_member_reviews_sp',
                      'get_member_statuses', 'get_member_statuses_sp',
                      'submit_member_review', 'submit_member_review_sp',
                      'submit_committee_decision', 'submit_committee_decision_sp',
                      'upsert_member_status'
                  )
                  AND pg_get_functiondef(p.oid) ILIKE '%requisition_id%'
              )
          )
    LOOP
        EXECUTE format('DROP %s IF EXISTS %I.%I(%s) CASCADE',
            r.kind, r.schema_name, r.fname, r.fargs);
    END LOOP;
END
$$;

-- ============================================================
-- 8. REMOVE THE REQUISITIONING OFFICER ROLE AND ITS ASSIGNMENTS
-- ============================================================
DO $$
DECLARE
    v_role_id UUID;
BEGIN
    SELECT role_id INTO v_role_id
    FROM identity.roles
    WHERE role_name = 'RequisitioningOfficer';

    IF v_role_id IS NOT NULL THEN
        IF to_regclass('identity.user_role_audit') IS NOT NULL THEN
            DELETE FROM identity.user_role_audit
            WHERE new_role_id = v_role_id
               OR previous_role_id = v_role_id;
        END IF;

        DELETE FROM identity.internal_users
        WHERE role_id = v_role_id;

        DELETE FROM identity.internal_module_grants
        WHERE role_id = v_role_id;

        IF to_regclass('identity.internal_module_grant_audit') IS NOT NULL THEN
            DELETE FROM identity.internal_module_grant_audit
            WHERE role_id = v_role_id;
        END IF;

        DELETE FROM identity.role_permissions
        WHERE role_id = v_role_id;

        DELETE FROM identity.roles
        WHERE role_id = v_role_id;
    END IF;
END
$$;

-- ============================================================
-- 9. REMOVE REQUIREMENT.* PERMISSIONS
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
-- 10. REASSIGN THE NEEDS_COLLECTION STAGE AWAY FROM THE REMOVED ROLE
-- ============================================================
-- needs_collection.primary_owner_role is NOT NULL, so the stage is
-- reassigned to the formation officer who owns needs capture (formerly
-- flagged under the removed requisitioning officer role).
UPDATE procurement_workflow.workflow_stage_catalog
SET primary_owner_role = 'formation_officer'
WHERE primary_owner_role = 'requisitioning_officer';

UPDATE procurement_workflow.workflow_role_tasks
SET role_key = 'formation_officer'
WHERE role_key = 'requisitioning_officer';

DELETE FROM procurement_workflow.workflow_role_tasks
WHERE role_key = 'requisitioning_officer';

COMMIT;
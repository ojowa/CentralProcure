-- Migration 108: Remove Department Need Capture and Department Head Endorsement
BEGIN;

-- ============================================================
-- 1. UPDATE HISTORY RECORDS TO POINT TO BUDGET ALLOCATION
-- ============================================================
UPDATE procurement_workflow.workflow_instance_history
SET to_stage_key = 'budget_allocation_and_confirmation'
WHERE to_stage_key IN ('department_need_capture', 'department_head_endorsement');

UPDATE procurement_workflow.workflow_instance_history
SET from_stage_key = 'budget_allocation_and_confirmation'
WHERE from_stage_key IN ('department_need_capture', 'department_head_endorsement');

-- ============================================================
-- 2. REMOVE THE TWO STAGES
-- ============================================================
DELETE FROM procurement_workflow.workflow_stage_transitions
WHERE from_stage_key IN ('department_need_capture', 'department_head_endorsement')
   OR to_stage_key IN ('department_need_capture', 'department_head_endorsement');

DELETE FROM procurement_workflow.workflow_role_tasks
WHERE stage_key IN ('department_need_capture', 'department_head_endorsement');

DELETE FROM procurement_workflow.workflow_stage_catalog
WHERE stage_key IN ('department_need_capture', 'department_head_endorsement');

-- ============================================================
-- 3. FIX TRANSITIONS: needs_assessment → budget_allocation
-- ============================================================
INSERT INTO procurement_workflow.workflow_stage_transitions (from_stage_key, to_stage_key, transition_condition)
VALUES ('needs_assessment', 'budget_allocation_and_confirmation', 'Needs endorsed — proceed to budget allocation.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. RENUMBER STAGES
-- ============================================================
UPDATE procurement_workflow.workflow_stage_catalog SET sequence_no = 4 WHERE stage_key = 'budget_allocation_and_confirmation';
UPDATE procurement_workflow.workflow_stage_catalog SET sequence_no = 5 WHERE stage_key = 'comptroller_procurement_review';
UPDATE procurement_workflow.workflow_stage_catalog SET sequence_no = 6 WHERE stage_key = 'planning_committee_review';
UPDATE procurement_workflow.workflow_stage_catalog SET sequence_no = 7 WHERE stage_key = 'app_approval';

COMMIT;

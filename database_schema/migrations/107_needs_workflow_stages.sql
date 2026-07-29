-- Migration 107: Add Needs Workflow Stages to Blueprint
BEGIN;

-- ============================================================
-- 1. ADD 3 NEW STAGES
-- ============================================================
INSERT INTO procurement_workflow.workflow_stage_catalog (
    stage_key, phase_key, stage_title, stage_description,
    sequence_no, is_decision_gate, is_start, is_terminal,
    primary_owner_role, ppa_reference
)
VALUES
    ('needs_collection', 'app_planning', 'Needs Collection',
     'Units submit their procurement needs for the fiscal year.',
     1, FALSE, TRUE, FALSE, 'requisitioning_officer', 'PPA 2007 s.18'),
    ('needs_analysis', 'app_planning', 'Needs Analysis',
     'Procurement consolidates and analyzes needs across all units.',
     2, FALSE, FALSE, FALSE, 'comptroller_procurement', 'PPA 2007 s.18'),
    ('needs_assessment', 'app_planning', 'Needs Assessment',
     'Head of Procurement endorses or rejects consolidated needs.',
     3, TRUE, FALSE, FALSE, 'comptroller_procurement', 'PPA 2007 s.18')
ON CONFLICT (stage_key) DO NOTHING;

-- ============================================================
-- 2. RENUMBER EXISTING STAGES (shift by 3)
-- ============================================================
UPDATE procurement_workflow.workflow_stage_catalog
SET sequence_no = sequence_no + 3
WHERE stage_key NOT IN ('needs_collection', 'needs_analysis', 'needs_assessment')
  AND phase_key = 'app_planning';

-- ============================================================
-- 3. UPDATE TRANSITIONS
-- ============================================================

-- Remove old start transition (department_need_capture was start)
DELETE FROM procurement_workflow.workflow_stage_transitions
WHERE from_stage_key = 'department_need_capture' AND to_stage_key = 'department_head_endorsement';

-- Add new transitions for needs workflow
INSERT INTO procurement_workflow.workflow_stage_transitions (from_stage_key, to_stage_key, transition_condition)
VALUES
    ('needs_collection', 'needs_analysis', 'Units have submitted needs for consolidation.'),
    ('needs_analysis', 'needs_assessment', 'Analysis complete and ready for endorsement.'),
    ('needs_assessment', 'department_need_capture', 'Needs endorsed — create requisitions from assessment.')
ON CONFLICT DO NOTHING;

-- Re-create the old transition (department_need_capture -> department_head_endorsement)
INSERT INTO procurement_workflow.workflow_stage_transitions (from_stage_key, to_stage_key, transition_condition)
VALUES
    ('department_need_capture', 'department_head_endorsement', 'Requisition officer submits departmental need for endorsement.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. UPDATE ROLE TASKS
-- ============================================================
INSERT INTO procurement_workflow.workflow_role_tasks (role_key, display_name, stage_key, task_description, expected_outcome)
VALUES
    ('requisitioning_officer', 'Requisitioning Officer', 'needs_collection', 'Create and submit unit needs collection for the fiscal year.', 'Submitted needs collection.'),
    ('comptroller_procurement', 'Comptroller Procurement', 'needs_analysis', 'Consolidate needs across units and run analysis.', 'Analysis report with aggregated items.'),
    ('comptroller_procurement', 'Comptroller Procurement', 'needs_assessment', 'Review analysis and endorse or reject consolidated needs.', 'Assessment endorsed or rejected.')
ON CONFLICT DO NOTHING;

COMMIT;

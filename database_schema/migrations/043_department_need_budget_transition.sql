BEGIN;

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_description = 'Requisitioning Officer initiates departmental need capture and the Department Head confirms it before budget confirmation and committee review.',
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'department_need_capture';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    sequence_no = 2,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'budget_confirmation';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    sequence_no = 3,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'planning_committee_review';

DELETE FROM procurement_workflow.workflow_stage_transitions
WHERE from_stage_key = 'department_need_capture'
  AND to_stage_key = 'planning_committee_review';

DELETE FROM procurement_workflow.workflow_stage_transitions
WHERE from_stage_key = 'planning_committee_review'
  AND to_stage_key = 'budget_confirmation';

INSERT INTO procurement_workflow.workflow_stage_transitions (
    from_stage_key,
    to_stage_key,
    transition_condition
)
SELECT *
FROM (
    VALUES
        ('department_need_capture', 'budget_confirmation', 'Department Head confirms the departmental need before budget review.'),
        ('budget_confirmation', 'planning_committee_review', 'Budget readiness confirmed for committee review.')
) AS seed (from_stage_key, to_stage_key, transition_condition)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_stage_transitions existing
    WHERE existing.from_stage_key = seed.from_stage_key
      AND existing.to_stage_key = seed.to_stage_key
);

UPDATE procurement_workflow.workflow_role_tasks
SET
    task_description = 'Confirm the departmental need before budget review.',
    expected_outcome = 'Department submission is confirmed and accountable for budget verification.'
WHERE stage_key = 'department_need_capture'
  AND role_key = 'department_head';

UPDATE procurement_workflow.workflow_instances wi
SET
    current_stage_key = 'budget_confirmation',
    last_transition_reason = 'Aligned to Department Head budget review transition.',
    updated_at = CURRENT_TIMESTAMP
FROM procurement_workflow.procurement_plans p
WHERE wi.entity_type = 'procurement_plan'
  AND wi.entity_id = p.plan_id
  AND wi.current_stage_key = 'planning_committee_review'
  AND p.status = 'Submitted';

COMMIT;

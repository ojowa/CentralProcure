BEGIN;

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_description = 'Requisitioning Officer initiates departmental need capture and the Department Head confirms it before committee review.',
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'department_need_capture';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    sequence_no = 2,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'planning_committee_review';

DELETE FROM procurement_workflow.workflow_stage_transitions
WHERE from_stage_key = 'department_need_capture'
  AND to_stage_key = 'planning_committee_review';

INSERT INTO procurement_workflow.workflow_stage_transitions (
    from_stage_key,
    to_stage_key,
    transition_condition
)
SELECT *
FROM (
    VALUES
        ('department_need_capture', 'planning_committee_review', 'Department Head confirms the departmental need before committee review.')
) AS seed (from_stage_key, to_stage_key, transition_condition)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_stage_transitions existing
    WHERE existing.from_stage_key = seed.from_stage_key
      AND existing.to_stage_key = seed.to_stage_key
);

UPDATE procurement_workflow.workflow_role_tasks
SET
    task_description = 'Confirm the departmental need before committee review.',
    expected_outcome = 'Department submission is confirmed and accountable for committee review.'
WHERE stage_key = 'department_need_capture'
  AND role_key = 'department_head';

COMMIT;

-- Migration 042: Refine department need capture initiation/confirmation wording

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_description = 'Requisitioning Officer initiates departmental need capture and the Department Head confirms it before committee review.',
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'department_need_capture';

UPDATE procurement_workflow.workflow_stage_transitions
SET
    transition_condition = 'Department Head confirms the departmental need for committee review.'
WHERE from_stage_key = 'department_need_capture'
  AND to_stage_key = 'planning_committee_review';

UPDATE procurement_workflow.workflow_role_tasks
SET
    task_description = 'Initiate departmental need capture and scope the requirement.',
    expected_outcome = 'Department requirement is initiated for confirmation.'
WHERE stage_key = 'department_need_capture'
  AND role_key = 'requisitioning_officer';

UPDATE procurement_workflow.workflow_role_tasks
SET
    task_description = 'Confirm the departmental need before committee review.',
    expected_outcome = 'Department submission is confirmed and accountable.'
WHERE stage_key = 'department_need_capture'
  AND role_key = 'department_head';

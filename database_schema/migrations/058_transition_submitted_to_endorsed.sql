BEGIN;

UPDATE procurement_workflow.workflow_stage_transitions
SET transition_condition = 'Submitted requisition moves to Department Head endorsement.'
WHERE from_stage_key = 'department_need_capture'
  AND to_stage_key = 'department_head_endorsement';

COMMIT;

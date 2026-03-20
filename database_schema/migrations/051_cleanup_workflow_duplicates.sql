BEGIN;

DELETE FROM procurement_workflow.workflow_stage_transitions
WHERE from_stage_key = 'budget_confirmation'
  AND to_stage_key = 'app_approval'
  AND transition_condition = 'Budget appropriation confirmed.';

UPDATE procurement_workflow.workflow_role_tasks
SET
    display_name = 'Budget Officer',
    task_description = 'Confirm final appropriation and affordability.',
    expected_outcome = 'Only funded APP entries progress.'
WHERE role_key = 'financial_unit_officer'
  AND stage_key = 'budget_confirmation';

DELETE FROM procurement_workflow.workflow_role_tasks
WHERE role_key = 'requisitioning_officer'
  AND stage_key = 'department_need_capture'
  AND task_description = 'Initiate departmental need capture and scope the requirement.';

DELETE FROM procurement_workflow.workflow_role_tasks
WHERE role_key = 'department_head'
  AND stage_key = 'department_head_endorsement'
  AND ctid NOT IN (
      SELECT MIN(ctid)
      FROM procurement_workflow.workflow_role_tasks
      WHERE role_key = 'department_head'
        AND stage_key = 'department_head_endorsement'
  );

COMMIT;

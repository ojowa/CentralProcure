BEGIN;

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

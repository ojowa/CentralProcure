BEGIN;

UPDATE procurement_workflow.workflow_stage_catalog
SET primary_owner_role = 'comptroller_procurement',
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'app_approval';

DELETE FROM procurement_workflow.workflow_role_tasks
WHERE stage_key = 'app_approval';

INSERT INTO procurement_workflow.workflow_role_tasks (
    role_key,
    display_name,
    stage_key,
    task_description,
    expected_outcome
)
SELECT
    'comptroller_procurement',
    'Comptroller Procurement',
    'app_approval',
    'Approve the annual procurement plan as head of the procurement unit.',
    'APP is approved for execution.'
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_role_tasks
    WHERE role_key = 'comptroller_procurement'
      AND stage_key = 'app_approval'
);

COMMIT;

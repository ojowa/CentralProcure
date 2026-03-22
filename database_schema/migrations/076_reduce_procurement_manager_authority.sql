BEGIN;

UPDATE procurement_workflow.workflow_stage_catalog
SET primary_owner_role = 'comptroller_procurement',
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'threshold_resolution';

DELETE FROM procurement_workflow.workflow_role_tasks
WHERE role_key = 'procurement_manager'
  AND stage_key = 'threshold_resolution';

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
    'threshold_resolution',
    'Resolve threshold band and approval route as head of the procurement unit.',
    'Approval path and BPP gate are explicit.'
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_role_tasks
    WHERE role_key = 'comptroller_procurement'
      AND stage_key = 'threshold_resolution'
);

COMMIT;

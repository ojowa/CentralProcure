BEGIN;

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
    'method_validation',
    'Approve the validated procurement method and authorize movement to solicitation.',
    'Method validation is accepted and the tender can proceed to publication.'
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_role_tasks
    WHERE role_key = 'comptroller_procurement'
      AND stage_key = 'method_validation'
);

COMMIT;

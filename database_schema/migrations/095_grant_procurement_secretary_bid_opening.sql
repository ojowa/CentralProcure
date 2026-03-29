BEGIN;

INSERT INTO procurement_workflow.workflow_role_tasks (
    role_key,
    display_name,
    stage_key,
    task_description,
    expected_outcome
)
SELECT *
FROM (
    VALUES
        ('procurement_secretary', 'Procurement Secretary', 'bid_opening', 'Coordinate with Comptroller Procurement to schedule and document bid opening sessions.', 'Bid opening sessions are documented and ready for evaluation.'),
        ('comptroller_procurement', 'Comptroller Procurement', 'bid_opening', 'Ensure bid opening sessions are executed under statutory oversight.', 'Bid opening is compliant with PPA rules.')
) AS seed (
    role_key,
    display_name,
    stage_key,
    task_description,
    expected_outcome
)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_role_tasks existing
    WHERE existing.role_key = seed.role_key
      AND existing.stage_key = seed.stage_key
      AND existing.task_description = seed.task_description
);

COMMIT;

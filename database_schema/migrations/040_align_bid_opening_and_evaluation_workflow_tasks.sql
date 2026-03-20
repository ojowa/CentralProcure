-- Migration 040: Align bid opening tender workflow state and evaluation role tasks

INSERT INTO procurement_workflow.workflow_role_tasks (
    role_key,
    display_name,
    stage_key,
    task_description,
    expected_outcome
)
SELECT v.role_key, v.display_name, v.stage_key, v.task_description, v.completion_outcome
FROM (
    VALUES
        (
            'technical_evaluator',
            'Technical Evaluator',
            'evaluation',
            'Perform technical scoring.',
            'Technical responsiveness is assessed.'
        ),
        (
            'financial_evaluator',
            'Financial Evaluator',
            'evaluation',
            'Perform arithmetic and financial review.',
            'Commercial comparison is accurate.'
        )
) AS v(role_key, display_name, stage_key, task_description, completion_outcome)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_role_tasks wrt
    WHERE wrt.role_key = v.role_key
      AND wrt.stage_key = v.stage_key
);

WITH latest_session AS (
    SELECT DISTINCT ON (bos.tender_id)
        bos.tender_id,
        bos.status
    FROM vendor_sourcing.bid_opening_sessions bos
    ORDER BY bos.tender_id, bos.updated_at DESC, bos.created_at DESC
),
updated_instances AS (
    UPDATE procurement_workflow.workflow_instances wi
    SET
        current_stage_key = 'bid_opening',
        current_status = ls.status,
        last_transition_reason = 'Backfilled from bid opening session workflow alignment.',
        updated_at = CURRENT_TIMESTAMP
    FROM latest_session ls
    WHERE wi.entity_type = 'tender'
      AND wi.entity_id = ls.tender_id
      AND wi.current_stage_key = 'solicitation'
    RETURNING
        wi.instance_id,
        wi.current_stage_key,
        wi.current_status,
        ls.status AS new_status
)
INSERT INTO procurement_workflow.workflow_instance_history (
    instance_id,
    from_stage_key,
    to_stage_key,
    stage_status,
    transition_source,
    transition_reason,
    actor
)
SELECT
    ui.instance_id,
    ui.current_stage_key,
    'bid_opening',
    ui.new_status,
    'migration_040',
    'Backfilled from bid opening session workflow alignment.',
    'system_migration'
FROM updated_instances ui;

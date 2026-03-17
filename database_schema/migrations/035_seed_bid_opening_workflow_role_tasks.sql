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
        ('procurement_officer', 'Procurement Officer', 'bid_opening', 'Schedule, open, and record public bid opening sessions.', 'Bid opening records are complete and ready for evaluation.'),
        ('procurement_manager', 'Procurement Manager', 'bid_opening', 'Supervise bid opening readiness and validate opening records.', 'Bid opening oversight is exercised before evaluation proceeds.'),
        ('technical_evaluator', 'Technical Evaluator', 'bid_opening', 'Review opening records and confirm bid packages received for technical evaluation.', 'Technical evaluation starts from a complete opening record.'),
        ('financial_evaluator', 'Financial Evaluator', 'bid_opening', 'Review opening records and declared bid figures for downstream financial evaluation.', 'Financial evaluation starts from the official opening record.'),
        ('evaluation_committee', 'Evaluation Committee', 'bid_opening', 'Inspect the opening minutes, attendance, and submission record before evaluation.', 'Committee evaluation begins from a verified opening session.'),
        ('ict_admin', 'System Administrator', 'bid_opening', 'Maintain controlled access and operational support for bid opening sessions.', 'System access issues do not block compliant bid opening operations.'),
        ('admin', 'Admin', 'bid_opening', 'Provide administrative oversight for bid opening access and control.', 'Administrative oversight is available for exceptional bid opening cases.')
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

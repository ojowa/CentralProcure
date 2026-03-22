BEGIN;

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Department Need Capture',
    stage_description = 'Requisitioning Officer drafts and submits the departmental need.',
    sequence_no = 1,
    is_start = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'department_need_capture';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Department Head Endorsement',
    stage_description = 'Department Head endorses the departmental need before budget coding.',
    sequence_no = 2,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'department_head_endorsement';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Budget Code Allocation',
    stage_description = 'Allocate budget code only before committee review.',
    sequence_no = 3,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'budget_code_allocation';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Comptroller Procurement Review',
    stage_description = 'Comptroller Procurement approves the request for Planning Committee review.',
    sequence_no = 4,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'comptroller_procurement_review';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Planning Committee Review',
    stage_description = 'Validate need, packaging, aggregation, and cost assumptions.',
    sequence_no = 5,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'planning_committee_review';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'APP Approval',
    sequence_no = 6,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'app_approval';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Procurement Initiation',
    sequence_no = 7,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'procurement_initiation';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Threshold Resolution',
    sequence_no = 8,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'threshold_resolution';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Method Validation',
    sequence_no = 9,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'method_validation';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Solicitation',
    stage_description = 'Publish advert, invitation, EOI, or RFP in the lawful format.',
    sequence_no = 10,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'solicitation';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Bid Opening',
    sequence_no = 11,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'bid_opening';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Evaluation',
    sequence_no = 12,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'evaluation';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Tenders Board Review',
    sequence_no = 13,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'tenders_board_review';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Accounting Officer Review',
    sequence_no = 14,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'accounting_officer_review';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'BPP No Objection',
    sequence_no = 15,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'bpp_no_objection';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Award and Publication',
    sequence_no = 16,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'award_and_publication';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Contract Execution',
    sequence_no = 17,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'contract_execution';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Inspection and Payment',
    sequence_no = 18,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'inspection_and_payment';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Closeout and Audit',
    sequence_no = 19,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'closeout_and_audit';

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Administrative Review',
    sequence_no = 20,
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'administrative_review';

DELETE FROM procurement_workflow.workflow_stage_transitions
WHERE (from_stage_key, to_stage_key) IN (
    ('department_need_capture', 'planning_committee_review'),
    ('department_need_capture', 'planning_committee_review')
);

INSERT INTO procurement_workflow.workflow_stage_transitions (
    from_stage_key,
    to_stage_key,
    transition_condition
)
SELECT *
FROM (
    VALUES
        ('department_need_capture', 'department_head_endorsement', 'Requisition officer submits departmental need for endorsement.'),
        ('department_head_endorsement', 'budget_code_allocation', 'Department Head endorsement completed.'),
        ('budget_code_allocation', 'comptroller_procurement_review', 'Budget code allocated for planning review.'),
        ('comptroller_procurement_review', 'planning_committee_review', 'Comptroller Procurement approves for committee review.'),
        ('planning_committee_review', 'app_approval', 'Committee review complete and routed for APP approval.')
) AS seed (from_stage_key, to_stage_key, transition_condition)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_stage_transitions existing
    WHERE existing.from_stage_key = seed.from_stage_key
      AND existing.to_stage_key = seed.to_stage_key
      AND existing.transition_condition = seed.transition_condition
);

UPDATE procurement_workflow.workflow_role_tasks
SET
    stage_key = 'department_head_endorsement',
    task_description = 'Endorse the departmental request.',
    expected_outcome = 'Department endorsement is recorded.'
WHERE role_key = 'department_head'
  AND stage_key = 'department_need_capture';

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
        ('financial_unit_officer', 'Budget Officer', 'budget_code_allocation', 'Allocate budget code for the request.', 'Budget code is assigned.'),
        ('comptroller_procurement', 'Comptroller Procurement', 'comptroller_procurement_review', 'Approve the request for Planning Committee review.', 'Request is approved for committee consideration.')
) AS seed (role_key, display_name, stage_key, task_description, expected_outcome)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_role_tasks existing
    WHERE existing.role_key = seed.role_key
      AND existing.stage_key = seed.stage_key
      AND existing.task_description = seed.task_description
);

COMMIT;


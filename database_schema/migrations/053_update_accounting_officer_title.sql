BEGIN;

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'CGIS Approval',
    stage_description = 'CGIS exercises the direct low-value approval authority before award publication.'
WHERE stage_key = 'accounting_officer_review';

COMMIT;

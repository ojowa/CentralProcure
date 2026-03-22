-- Migration 041: Replace solicitation business label with original publication names

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Advert / Invitation / EOI / RFP',
    stage_description = 'Publish advert, invitation, EOI, or RFP in the lawful format.',
    updated_at = CURRENT_TIMESTAMP
WHERE stage_key = 'solicitation';

UPDATE procurement_workflow.workflow_role_tasks
SET
    task_description = 'Publish advert, invitation, EOI, or RFP using the required route.',
    expected_outcome = 'Competition is opened lawfully through the approved publication route.'
WHERE stage_key = 'solicitation'
  AND role_key = 'comptroller_procurement';

UPDATE procurement_workflow.workflow_stage_transitions
SET
    transition_condition = 'Advert, invitation, EOI, or RFP publication is complete and the submission period closes.'
WHERE from_stage_key = 'solicitation'
  AND to_stage_key = 'bid_opening';

UPDATE procurement_workflow.workflow_stage_transitions
SET
    transition_condition = 'Complaint resolved and procurement resumes from advert / invitation / EOI / RFP stage.'
WHERE from_stage_key = 'administrative_review'
  AND to_stage_key = 'solicitation';


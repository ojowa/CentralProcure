BEGIN;

UPDATE procurement_workflow.workflow_stage_catalog
SET
    stage_title = 'Advert / Invitation / EOI / RFP',
    stage_description = 'Publish advert, invitation, EOI, or RFP in the lawful format.'
WHERE stage_key = 'solicitation';

COMMIT;

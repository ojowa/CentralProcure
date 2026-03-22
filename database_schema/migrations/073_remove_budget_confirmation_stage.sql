BEGIN;

UPDATE procurement_workflow.workflow_instances
SET current_stage_key = 'app_approval',
    current_status = CASE
        WHEN current_status = 'Under Review' THEN 'Initial'
        ELSE current_status
    END,
    updated_at = NOW()
WHERE current_stage_key = 'budget_confirmation';

UPDATE procurement_workflow.workflow_instance_history
SET from_stage_key = CASE WHEN from_stage_key = 'budget_confirmation' THEN 'planning_committee_review' ELSE from_stage_key END,
    to_stage_key = CASE WHEN to_stage_key = 'budget_confirmation' THEN 'app_approval' ELSE to_stage_key END
WHERE from_stage_key = 'budget_confirmation'
   OR to_stage_key = 'budget_confirmation';

DELETE FROM procurement_workflow.workflow_stage_transitions
WHERE from_stage_key = 'budget_confirmation'
   OR to_stage_key = 'budget_confirmation';

DELETE FROM procurement_workflow.workflow_role_tasks
WHERE stage_key = 'budget_confirmation';

DELETE FROM procurement_workflow.workflow_stage_catalog
WHERE stage_key = 'budget_confirmation';

COMMIT;

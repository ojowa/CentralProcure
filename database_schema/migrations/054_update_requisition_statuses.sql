BEGIN;

UPDATE procurement_workflow.requisitions
SET status = 'Drafted-Request'
WHERE status = 'Draft';

UPDATE procurement_workflow.requisitions
SET status = 'Initial'
WHERE status = 'Submitted';

UPDATE procurement_workflow.workflow_instances
SET current_status = CASE current_status
    WHEN 'Draft' THEN 'Drafted-Request'
    WHEN 'Submitted' THEN 'Initial'
    ELSE current_status
END,
    updated_at = CURRENT_TIMESTAMP
WHERE entity_type = 'requisition'
  AND current_status IN ('Draft', 'Submitted');

UPDATE procurement_workflow.workflow_instance_history h
SET stage_status = CASE h.stage_status
    WHEN 'Draft' THEN 'Drafted-Request'
    WHEN 'Submitted' THEN 'Initial'
    ELSE h.stage_status
END
FROM procurement_workflow.workflow_instances wi
WHERE h.instance_id = wi.instance_id
  AND wi.entity_type = 'requisition'
  AND h.stage_status IN ('Draft', 'Submitted');

ALTER TABLE procurement_workflow.requisitions
    ALTER COLUMN status SET DEFAULT 'Drafted-Request';

ALTER TABLE procurement_workflow.requisitions
    DROP CONSTRAINT IF EXISTS requisitions_status_chk;

ALTER TABLE procurement_workflow.requisitions
    ADD CONSTRAINT requisitions_status_chk
    CHECK (status IN ('Drafted-Request', 'Initial', 'Under Review', 'Evaluation', 'Board Review', 'Approved', 'Rejected', 'Cancelled'));

CREATE OR REPLACE FUNCTION procurement_workflow.resolve_requisition_stage(p_status VARCHAR(50))
RETURNS VARCHAR(60)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN CASE
        WHEN p_status IS NULL THEN 'department_need_capture'
        WHEN p_status ILIKE 'Drafted-Request' THEN 'department_need_capture'
        WHEN p_status ILIKE 'Initial' THEN 'budget_code_allocation'
        WHEN p_status ILIKE 'Under Review' THEN 'planning_committee_review'
        WHEN p_status ILIKE 'Evaluation' THEN 'evaluation'
        WHEN p_status ILIKE 'Board Review' THEN 'tenders_board_review'
        WHEN p_status ILIKE 'Approved' THEN 'accounting_officer_review'
        WHEN p_status ILIKE 'Rejected' THEN 'department_need_capture'
        ELSE 'department_need_capture'
    END;
END;
$$;

UPDATE procurement_workflow.requisitions
SET current_stage = procurement_workflow.resolve_requisition_stage(status)
WHERE status IN ('Drafted-Request', 'Initial', 'Under Review', 'Evaluation', 'Board Review', 'Approved', 'Rejected')
  AND COALESCE(current_stage, '') <> procurement_workflow.resolve_requisition_stage(status);

UPDATE procurement_workflow.workflow_instances wi
SET current_stage_key = procurement_workflow.resolve_requisition_stage(r.status),
    current_status = r.status,
    record_title = r.title,
    parent_entity_type = CASE WHEN r.app_item_id IS NULL THEN NULL ELSE 'procurement_plan_item' END,
    parent_entity_id = r.app_item_id,
    amount = r.total_estimate,
    procurement_type = r.procurement_type,
    last_transition_reason = 'Requisition status label update to Drafted-Request/Initial.',
    updated_at = CURRENT_TIMESTAMP
FROM procurement_workflow.requisitions r
WHERE wi.entity_type = 'requisition'
  AND wi.entity_id = r.requisition_id;

COMMIT;

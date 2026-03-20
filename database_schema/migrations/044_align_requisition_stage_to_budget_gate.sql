BEGIN;

CREATE OR REPLACE FUNCTION procurement_workflow.resolve_requisition_stage(p_status VARCHAR(50))
RETURNS VARCHAR(60)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN CASE
        WHEN p_status IS NULL THEN 'department_need_capture'
        WHEN p_status ILIKE 'Draft' THEN 'department_need_capture'
        WHEN p_status ILIKE 'Submitted' THEN 'department_need_capture'
        WHEN p_status ILIKE 'Endorsed' THEN 'department_head_endorsement'
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
WHERE status IN ('Draft', 'Submitted', 'Endorsed', 'Initial', 'Under Review', 'Evaluation', 'Board Review', 'Approved', 'Rejected')
  AND COALESCE(current_stage, '') <> procurement_workflow.resolve_requisition_stage(status);

INSERT INTO procurement_workflow.workflow_instances (
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    parent_entity_type,
    parent_entity_id,
    amount,
    procurement_type,
    last_transition_reason
)
SELECT
    'requisition',
    r.requisition_id,
    procurement_workflow.resolve_requisition_stage(r.status),
    r.status,
    r.title,
    CASE WHEN r.app_item_id IS NULL THEN NULL ELSE 'procurement_plan_item' END,
    r.app_item_id,
    r.total_estimate,
    r.procurement_type,
    'Aligned requisition workflow to department-head and budget gate.'
FROM procurement_workflow.requisitions r
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_instances wi
    WHERE wi.entity_type = 'requisition'
      AND wi.entity_id = r.requisition_id
);

UPDATE procurement_workflow.workflow_instances wi
SET current_stage_key = procurement_workflow.resolve_requisition_stage(r.status),
    current_status = r.status,
    record_title = r.title,
    parent_entity_type = CASE WHEN r.app_item_id IS NULL THEN NULL ELSE 'procurement_plan_item' END,
    parent_entity_id = r.app_item_id,
    amount = r.total_estimate,
    procurement_type = r.procurement_type,
    last_transition_reason = 'Aligned requisition workflow to department-head and budget gate.',
    updated_at = CURRENT_TIMESTAMP
FROM procurement_workflow.requisitions r
WHERE wi.entity_type = 'requisition'
  AND wi.entity_id = r.requisition_id
  AND wi.current_stage_key <> procurement_workflow.resolve_requisition_stage(r.status);

COMMIT;

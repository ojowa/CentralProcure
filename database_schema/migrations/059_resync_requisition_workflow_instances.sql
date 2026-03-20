BEGIN;

UPDATE procurement_workflow.workflow_instances wi
SET current_stage_key = procurement_workflow.resolve_requisition_stage(r.status),
    current_status = r.status,
    updated_at = CURRENT_TIMESTAMP
FROM procurement_workflow.requisitions r
WHERE wi.entity_type = 'requisition'
  AND wi.entity_id = r.requisition_id
  AND wi.current_stage_key <> procurement_workflow.resolve_requisition_stage(r.status);

COMMIT;

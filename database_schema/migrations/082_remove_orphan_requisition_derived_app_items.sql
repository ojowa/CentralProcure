BEGIN;

DELETE FROM procurement_workflow.procurement_plan_items i
WHERE NOT EXISTS (
        SELECT 1
        FROM procurement_workflow.requisitions r
        WHERE r.app_item_id = i.plan_item_id
    )
  AND COALESCE(i.notes, '') IN (
        'Created from requisition approval.',
        'Created after finalized planning committee review.'
    );

COMMIT;

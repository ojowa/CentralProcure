BEGIN;

WITH invalid_links AS (
    SELECT
        r.requisition_id,
        r.app_item_id
    FROM procurement_workflow.requisitions r
    LEFT JOIN procurement_workflow.planning_committee_decisions d
      ON d.requisition_id = r.requisition_id
    WHERE r.app_item_id IS NOT NULL
      AND (
            d.decision_id IS NULL
            OR d.overall_decision <> 'Recommended'
          )
),
unlinked AS (
    UPDATE procurement_workflow.requisitions r
    SET app_item_id = NULL,
        updated_at = NOW()
    FROM invalid_links invalid
    WHERE r.requisition_id = invalid.requisition_id
    RETURNING invalid.app_item_id
)
DELETE FROM procurement_workflow.procurement_plan_items i
WHERE i.plan_item_id IN (
    SELECT DISTINCT app_item_id
    FROM unlinked
    WHERE app_item_id IS NOT NULL
)
AND NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.requisitions r
    WHERE r.app_item_id = i.plan_item_id
);

COMMIT;

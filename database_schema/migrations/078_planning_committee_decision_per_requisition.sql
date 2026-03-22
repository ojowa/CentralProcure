BEGIN;

ALTER TABLE procurement_workflow.planning_committee_decisions
    ADD COLUMN IF NOT EXISTS requisition_id UUID NULL;

UPDATE procurement_workflow.planning_committee_decisions d
SET requisition_id = src.requisition_id
FROM (
    SELECT DISTINCT ON (d2.decision_id)
        d2.decision_id,
        COALESCE(l.requisition_id, r.requisition_id) AS requisition_id
    FROM procurement_workflow.planning_committee_decisions d2
    LEFT JOIN procurement_workflow.planning_committee_plan_links l
      ON l.plan_id = d2.plan_id
    LEFT JOIN procurement_workflow.requisitions r
      ON r.app_item_id IN (
          SELECT i.plan_item_id
          FROM procurement_workflow.procurement_plan_items i
          WHERE i.plan_id = d2.plan_id
      )
    WHERE COALESCE(l.requisition_id, r.requisition_id) IS NOT NULL
) AS src
WHERE d.decision_id = src.decision_id
  AND d.requisition_id IS NULL;

ALTER TABLE procurement_workflow.planning_committee_decisions
    DROP CONSTRAINT IF EXISTS planning_committee_decisions_plan_id_key;

ALTER TABLE procurement_workflow.planning_committee_decisions
    DROP CONSTRAINT IF EXISTS fk_committee_decision_requisition;

ALTER TABLE procurement_workflow.planning_committee_decisions
    ADD CONSTRAINT fk_committee_decision_requisition
        FOREIGN KEY (requisition_id)
        REFERENCES procurement_workflow.requisitions(requisition_id)
        ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_planning_committee_decisions_requisition
    ON procurement_workflow.planning_committee_decisions(requisition_id)
    WHERE requisition_id IS NOT NULL;

COMMIT;

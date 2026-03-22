BEGIN;

DELETE FROM procurement_workflow.planning_committee_decisions
WHERE requisition_id IS NULL;

ALTER TABLE procurement_workflow.planning_committee_decisions
    ALTER COLUMN requisition_id SET NOT NULL;

DROP INDEX IF EXISTS procurement_workflow.uq_planning_committee_decisions_requisition;

ALTER TABLE procurement_workflow.planning_committee_decisions
    DROP CONSTRAINT IF EXISTS uq_planning_committee_decisions_requisition;

ALTER TABLE procurement_workflow.planning_committee_decisions
    ADD CONSTRAINT uq_planning_committee_decisions_requisition
        UNIQUE (requisition_id);

COMMIT;

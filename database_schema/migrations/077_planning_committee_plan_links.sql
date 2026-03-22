BEGIN;

CREATE TABLE IF NOT EXISTS procurement_workflow.planning_committee_plan_links (
    requisition_id UUID PRIMARY KEY
        REFERENCES procurement_workflow.requisitions(requisition_id)
        ON DELETE CASCADE,
    plan_id UUID NOT NULL
        REFERENCES procurement_workflow.procurement_plans(plan_id)
        ON DELETE CASCADE,
    linked_by VARCHAR(255) NULL,
    linked_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_planning_committee_plan_links_plan_id
    ON procurement_workflow.planning_committee_plan_links(plan_id);

INSERT INTO procurement_workflow.planning_committee_plan_links (
    requisition_id,
    plan_id,
    linked_by,
    linked_at
)
SELECT
    r.requisition_id,
    i.plan_id,
    'migration_077',
    NOW()
FROM procurement_workflow.requisitions r
JOIN procurement_workflow.procurement_plan_items i
  ON i.plan_item_id = r.app_item_id
ON CONFLICT (requisition_id) DO NOTHING;

COMMIT;

-- Migration 063: Prevent APP item from being linked to multiple requisitions
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS requisitions_app_item_id_ux
    ON procurement_workflow.requisitions (app_item_id)
    WHERE app_item_id IS NOT NULL;

COMMIT;

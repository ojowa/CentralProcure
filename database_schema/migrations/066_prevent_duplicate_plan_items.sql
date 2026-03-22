-- Migration 066: Prevent duplicate APP items by plan/description/budget/procurement type
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS procurement_plan_items_unique_detail_ux
    ON procurement_workflow.procurement_plan_items (
        plan_id,
        lower(trim(description)),
        lower(trim(budget_code)),
        lower(trim(COALESCE(procurement_type, '')))
    );

COMMIT;

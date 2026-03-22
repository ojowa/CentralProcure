-- Migration 069: Prevent duplicate procurement plans by title/department/fiscal year
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS procurement_plans_unique_title_ux
    ON procurement_workflow.procurement_plans (
        lower(trim(plan_title)),
        lower(trim(department)),
        fiscal_year
    );

COMMIT;

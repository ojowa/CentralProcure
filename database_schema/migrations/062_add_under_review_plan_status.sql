-- Migration 062: Allow Under Review status for procurement plans
BEGIN;

ALTER TABLE procurement_workflow.procurement_plans
    DROP CONSTRAINT IF EXISTS procurement_plans_status_chk;

ALTER TABLE procurement_workflow.procurement_plans
    ADD CONSTRAINT procurement_plans_status_chk
    CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Cancelled'));

COMMIT;

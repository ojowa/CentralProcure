ALTER TABLE procurement_workflow.procurement_plans
    DROP CONSTRAINT IF EXISTS procurement_plans_status_chk;

ALTER TABLE procurement_workflow.procurement_plans
    ADD CONSTRAINT procurement_plans_status_chk
    CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Returned', 'Rejected', 'Cancelled'));

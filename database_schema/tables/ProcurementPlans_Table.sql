-- Procurement Plans Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.procurement_plans (
    plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    yearly_app_id UUID NULL REFERENCES procurement_workflow.yearly_apps(yearly_app_id) ON DELETE RESTRICT,
    plan_title VARCHAR(255) NOT NULL,
    department VARCHAR(150) NOT NULL,
    fiscal_year INT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    total_budget DECIMAL(18, 2) NOT NULL DEFAULT 0,
    notes TEXT NULL,
    submitted_at TIMESTAMP WITHOUT TIME ZONE NULL,
    approved_at TIMESTAMP WITHOUT TIME ZONE NULL,
    -- Audit fields
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'procurement_plans_status_chk'
    ) THEN
        ALTER TABLE procurement_workflow.procurement_plans
            ADD CONSTRAINT procurement_plans_status_chk
            CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Returned', 'Rejected', 'Cancelled'));
    END IF;
END $$;

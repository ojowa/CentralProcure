-- Yearly APP Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.yearly_apps (
    yearly_app_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Under Review',
    notes TEXT NULL,
    submitted_at TIMESTAMP WITHOUT TIME ZONE NULL,
    approved_at TIMESTAMP WITHOUT TIME ZONE NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

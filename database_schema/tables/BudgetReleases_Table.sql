-- Budget Releases Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.budget_releases (
    release_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appropriation_id UUID NOT NULL REFERENCES procurement_workflow.budget_appropriations(appropriation_id) ON DELETE CASCADE,
    amount DECIMAL(18, 2) NOT NULL,
    release_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    notes TEXT NULL,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

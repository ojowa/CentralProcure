-- Budget Expenditures Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.budget_expenditures (
    expenditure_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commitment_id UUID NOT NULL REFERENCES procurement_workflow.budget_commitments(commitment_id) ON DELETE CASCADE,
    amount DECIMAL(18, 2) NOT NULL,
    spent_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    notes TEXT NULL,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

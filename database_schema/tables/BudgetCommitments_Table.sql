-- Budget Commitments Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.budget_commitments (
    commitment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appropriation_id UUID REFERENCES procurement_workflow.budget_appropriations(appropriation_id) ON DELETE SET NULL,
    requisition_id UUID NULL REFERENCES procurement_workflow.requisitions(requisition_id) ON DELETE SET NULL,
    tender_id UUID NULL REFERENCES vendor_sourcing.tenders(tender_id) ON DELETE SET NULL,
    fiscal_year INT NOT NULL,
    department VARCHAR(150) NOT NULL,
    budget_code VARCHAR(60) NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Reserved',
    committed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

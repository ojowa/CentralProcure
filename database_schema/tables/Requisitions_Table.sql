-- Requisitions Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.requisitions (
    requisition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    department VARCHAR(150) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    priority VARCHAR(50) NULL,
    procurement_type VARCHAR(50) NULL,
    funding_source VARCHAR(120) NULL,
    budget_code VARCHAR(60) NULL,
    app_item_id UUID NULL REFERENCES procurement_workflow.procurement_plan_items(plan_item_id) ON DELETE SET NULL,
    project_code VARCHAR(60) NULL,
    required_by TIMESTAMP WITHOUT TIME ZONE NULL,
    delivery_location TEXT NULL,
    justification TEXT NULL,
    risk_notes TEXT NULL,
    total_estimate DECIMAL(18, 2) NOT NULL DEFAULT 0,
    current_stage VARCHAR(60) NULL,
    -- Audit fields
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

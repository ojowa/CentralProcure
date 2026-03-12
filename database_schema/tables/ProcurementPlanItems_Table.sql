-- Procurement Plan Items Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.procurement_plan_items (
    plan_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES procurement_workflow.procurement_plans(plan_id) ON DELETE CASCADE,
    item_code VARCHAR(60) NULL,
    description TEXT NOT NULL,
    budget_code VARCHAR(60) NOT NULL,
    procurement_type VARCHAR(50) NULL,
    estimated_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'Active',
    notes TEXT NULL,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

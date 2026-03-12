-- Requisition Line Items Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.requisition_line_items (
    line_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID NOT NULL REFERENCES procurement_workflow.requisitions(requisition_id) ON DELETE CASCADE,
    item_code VARCHAR(50) NULL,
    description TEXT NOT NULL,
    unit VARCHAR(40) NOT NULL,
    quantity DECIMAL(18, 2) NOT NULL,
    unit_cost DECIMAL(18, 2) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Tenders Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS vendor_sourcing.tenders (
    tender_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Draft', -- e.g., 'Draft', 'Published', 'Closed', 'Awarded'
    budget DECIMAL(18, 2),
    department VARCHAR(150) NULL,
    budget_code VARCHAR(60) NULL,
    fiscal_year INT NULL,
    specifications TEXT,
    eligibility_criteria TEXT,
    evaluation_criteria TEXT,
    publish_date TIMESTAMP WITHOUT TIME ZONE,
    opening_date TIMESTAMP WITHOUT TIME ZONE,
    closing_date TIMESTAMP WITHOUT TIME ZONE,
    -- Audit fields
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);


-- Inspections Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS post_award.inspections (
    inspection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_code VARCHAR(50) NOT NULL UNIQUE,
    contract_code VARCHAR(50) NOT NULL,
    tender_title VARCHAR(255) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
    scheduled_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    completed_date TIMESTAMP WITHOUT TIME ZONE NULL,
    inspector_name VARCHAR(150) NOT NULL,
    outcome VARCHAR(50) NULL,
    location VARCHAR(255) NOT NULL,
    notes TEXT NULL,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

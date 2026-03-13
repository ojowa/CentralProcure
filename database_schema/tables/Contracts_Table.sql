-- Contracts Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS post_award.contracts (
    contract_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_code VARCHAR(50) NOT NULL UNIQUE,
    tender_title VARCHAR(255) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    contract_value DECIMAL(18, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    start_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    end_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    contract_manager VARCHAR(150) NOT NULL,
    notes TEXT NULL,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

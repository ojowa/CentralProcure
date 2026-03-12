-- Contract Awards Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS post_award.contract_awards (
    award_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    award_code VARCHAR(50) NOT NULL UNIQUE,
    tender_title VARCHAR(255) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    award_value DECIMAL(18, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    award_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    contract_start TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    contract_end TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    funding_source VARCHAR(120) NOT NULL,
    notes TEXT NULL,
    published_at TIMESTAMP WITHOUT TIME ZONE NULL,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

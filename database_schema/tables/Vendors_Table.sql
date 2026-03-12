-- Vendors Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS identity.vendors (
    vendor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100) UNIQUE NOT NULL, -- CAC
    tax_id VARCHAR(100) UNIQUE NOT NULL, -- TIN
    company_address TEXT NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    registration_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITHOUT TIME ZONE NULL,
    vendor_status VARCHAR(50) NOT NULL DEFAULT 'Pending Approval',
    is_active BOOLEAN DEFAULT TRUE,
    -- Audit fields
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

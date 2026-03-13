-- Compliance Documents Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS identity.compliance_documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES identity.vendors(vendor_id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL, -- e.g., 'CAC', 'TIN', 'VAT', 'PENCOM'
    document_url TEXT NOT NULL,
    expiry_date DATE,
    verification_status VARCHAR(50) DEFAULT 'Pending',
    verified_by VARCHAR(255),
    verified_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Compliance Document History Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS identity.compliance_document_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    vendor_id UUID NOT NULL REFERENCES identity.vendors(vendor_id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    document_url TEXT NOT NULL,
    expiry_date DATE,
    verification_status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_document_history_vendor_idx
    ON identity.compliance_document_history (vendor_id, document_type, created_at DESC);

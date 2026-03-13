-- Bids Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS vendor_sourcing.bids (
    bid_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL REFERENCES vendor_sourcing.tenders(tender_id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES identity.vendors(vendor_id) ON DELETE CASCADE,
    bid_amount DECIMAL(18, 2) NOT NULL,
    technical_proposal_url TEXT,
    validity_period_days INT NOT NULL DEFAULT 90,
    submission_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'Submitted', -- e.g., 'Submitted', 'Under Review', 'Accepted', 'Rejected'
    remarks TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Prevent duplicate bids per vendor per tender
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bids_tender_vendor_unique'
          AND conrelid = 'vendor_sourcing.bids'::regclass
    ) THEN
        ALTER TABLE vendor_sourcing.bids
            ADD CONSTRAINT bids_tender_vendor_unique UNIQUE (tender_id, vendor_id);
    END IF;
END
$$;


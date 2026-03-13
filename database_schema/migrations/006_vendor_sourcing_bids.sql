-- Migration 006: Vendor Sourcing Bids (PostgreSQL)
BEGIN;

CREATE SCHEMA IF NOT EXISTS vendor_sourcing;

CREATE TABLE IF NOT EXISTS vendor_sourcing.bids (
    bid_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL REFERENCES vendor_sourcing.tenders(tender_id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES identity.vendors(vendor_id) ON DELETE CASCADE,
    bid_amount DECIMAL(18, 2) NOT NULL,
    technical_proposal_url TEXT,
    validity_period_days INT NOT NULL DEFAULT 90,
    submission_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'Submitted',
    remarks TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'bids'
    ) THEN
        INSERT INTO vendor_sourcing.bids (
            bid_id,
            tender_id,
            vendor_id,
            bid_amount,
            technical_proposal_url,
            validity_period_days,
            submission_date,
            status,
            remarks,
            created_at,
            updated_at
        )
        SELECT
            b.bid_id,
            b.tender_id,
            b.vendor_id,
            b.bid_amount,
            b.technical_proposal_url,
            b.validity_period_days,
            b.submission_date,
            b.status,
            b.remarks,
            b.created_at,
            b.updated_at
        FROM public.bids b
        ON CONFLICT (bid_id) DO NOTHING;
    END IF;
END
$$;

COMMIT;

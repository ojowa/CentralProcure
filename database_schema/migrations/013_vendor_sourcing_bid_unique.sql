-- Migration 013: Prevent duplicate bids per vendor per tender
BEGIN;

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

COMMIT;

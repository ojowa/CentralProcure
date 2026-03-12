-- Migration 022: Harden bid opening session state rules for PPA-aligned workflow (PostgreSQL)
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bid_opening_state_chk'
          AND conrelid = 'vendor_sourcing.bid_opening_sessions'::regclass
    ) THEN
        ALTER TABLE vendor_sourcing.bid_opening_sessions
            ADD CONSTRAINT bid_opening_state_chk
            CHECK (
                (status = 'Scheduled' AND opened_at IS NULL AND closed_at IS NULL)
                OR (status = 'Open' AND opened_at IS NOT NULL AND closed_at IS NULL)
                OR (status = 'Closed' AND opened_at IS NOT NULL AND closed_at IS NOT NULL AND closed_at >= opened_at)
                OR (status = 'Cancelled' AND opened_at IS NULL AND closed_at IS NULL)
            );
    END IF;
END
$$;

COMMIT;

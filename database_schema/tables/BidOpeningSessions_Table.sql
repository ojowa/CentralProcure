CREATE TABLE IF NOT EXISTS vendor_sourcing.bid_opening_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL REFERENCES vendor_sourcing.tenders(tender_id) ON DELETE CASCADE,
    session_title VARCHAR(300) NOT NULL,
    location VARCHAR(255),
    scheduled_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Scheduled',
    opened_at TIMESTAMP WITHOUT TIME ZONE,
    closed_at TIMESTAMP WITHOUT TIME ZONE,
    notes TEXT,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

ALTER TABLE vendor_sourcing.bid_opening_sessions
    DROP CONSTRAINT IF EXISTS bid_opening_state_chk;

ALTER TABLE vendor_sourcing.bid_opening_sessions
    ADD CONSTRAINT bid_opening_state_chk
    CHECK (
        (status = 'Scheduled' AND opened_at IS NULL AND closed_at IS NULL)
        OR (status = 'Open' AND opened_at IS NOT NULL AND closed_at IS NULL)
        OR (status = 'Closed' AND opened_at IS NOT NULL AND closed_at IS NOT NULL AND closed_at >= opened_at)
        OR (status = 'Cancelled' AND opened_at IS NULL AND closed_at IS NULL)
    );

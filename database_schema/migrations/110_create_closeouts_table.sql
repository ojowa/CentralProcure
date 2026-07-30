-- Migration 110: Create post_award.closeouts table

BEGIN;

CREATE TABLE IF NOT EXISTS post_award.closeouts (
    closeout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_code VARCHAR(50) NOT NULL,
    closeout_code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(40) NOT NULL DEFAULT 'Pending',
    initiated_by VARCHAR(255) NULL,
    initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT closeouts_status_chk
        CHECK (status IN ('Pending', 'InProgress', 'Completed', 'Rejected')),
    CONSTRAINT fk_closeouts_contract
        FOREIGN KEY (contract_code)
        REFERENCES post_award.contracts(contract_code)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_closeouts_status
    ON post_award.closeouts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_closeouts_contract
    ON post_award.closeouts (contract_code);

COMMIT;

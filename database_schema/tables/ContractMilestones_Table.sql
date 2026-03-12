-- Contract Milestones Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS post_award.contract_milestones (
    milestone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_code VARCHAR(50) NOT NULL REFERENCES post_award.contracts(contract_code) ON DELETE CASCADE,
    milestone_title VARCHAR(180) NOT NULL,
    status_after VARCHAR(50) NOT NULL,
    progress_after INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL,
    contract_manager VARCHAR(150) NOT NULL,
    recorded_by VARCHAR(255) NOT NULL DEFAULT CURRENT_USER,
    recorded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

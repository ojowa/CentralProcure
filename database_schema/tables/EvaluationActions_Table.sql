-- Evaluation Actions Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.evaluation_actions (
    action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES procurement_workflow.evaluation_reports(report_id) ON DELETE CASCADE,
    bid_id UUID NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    score_percentage DECIMAL(5, 2) NOT NULL,
    ranking INTEGER NOT NULL,
    technical_pass BOOLEAN NOT NULL,
    financial_rank INTEGER NOT NULL,
    recommendation VARCHAR(50) NOT NULL, -- 'Award', 'Qualified', 'Disqualified'
    action_notes TEXT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evaluation_actions_report_idx
    ON procurement_workflow.evaluation_actions (report_id, ranking);

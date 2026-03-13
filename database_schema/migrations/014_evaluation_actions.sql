-- Migration 014: Evaluation Actions (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.evaluation_actions (
    action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type VARCHAR(50) NOT NULL,
    report_code VARCHAR(50) NULL,
    tender_id UUID NOT NULL,
    notes TEXT NULL,
    reason TEXT NULL,
    justification TEXT NULL,
    recommendation VARCHAR(120) NULL,
    threshold_note TEXT NULL,
    requested_by VARCHAR(255) NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_actions_tender
    ON procurement_workflow.evaluation_actions (tender_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_actions_type
    ON procurement_workflow.evaluation_actions (action_type);

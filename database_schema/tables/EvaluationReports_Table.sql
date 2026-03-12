-- Evaluation Reports Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.evaluation_reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_code VARCHAR(50) NOT NULL UNIQUE,
    tender_id UUID NOT NULL,
    tender_title VARCHAR(255) NOT NULL,
    committee_lead VARCHAR(150) NOT NULL,
    recommendation VARCHAR(120) NOT NULL,
    score_summary VARCHAR(120) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    submitted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    notes TEXT NULL,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

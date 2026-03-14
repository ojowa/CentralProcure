-- Workflow Stage Catalog Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.workflow_stage_catalog (
    stage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_key VARCHAR(80) NOT NULL UNIQUE,
    phase_key VARCHAR(80) NOT NULL,
    stage_title VARCHAR(160) NOT NULL,
    stage_description TEXT NOT NULL,
    sequence_no INTEGER NOT NULL,
    is_decision_gate BOOLEAN NOT NULL DEFAULT FALSE,
    is_start BOOLEAN NOT NULL DEFAULT FALSE,
    is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
    primary_owner_role VARCHAR(80) NOT NULL,
    ppa_reference VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_stage_catalog_phase_sequence
    ON procurement_workflow.workflow_stage_catalog (phase_key, sequence_no);

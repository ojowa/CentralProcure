-- Workflow Stage Transitions Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.workflow_stage_transitions (
    transition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_stage_key VARCHAR(80) NOT NULL REFERENCES procurement_workflow.workflow_stage_catalog(stage_key) ON DELETE CASCADE,
    to_stage_key VARCHAR(80) NOT NULL REFERENCES procurement_workflow.workflow_stage_catalog(stage_key) ON DELETE CASCADE,
    transition_condition TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_stage_transitions_from_stage
    ON procurement_workflow.workflow_stage_transitions (from_stage_key);

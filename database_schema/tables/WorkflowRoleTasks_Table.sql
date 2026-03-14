-- Workflow Role Tasks Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.workflow_role_tasks (
    role_task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_key VARCHAR(80) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    stage_key VARCHAR(80) NOT NULL REFERENCES procurement_workflow.workflow_stage_catalog(stage_key) ON DELETE CASCADE,
    task_description TEXT NOT NULL,
    expected_outcome TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_role_tasks_role_stage
    ON procurement_workflow.workflow_role_tasks (role_key, stage_key);

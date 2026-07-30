-- Recreate administrative_reviews with columns matching frontend types
DROP TABLE IF EXISTS procurement_workflow.administrative_reviews CASCADE;

CREATE TABLE procurement_workflow.administrative_reviews (
    complaint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_reference VARCHAR(80) NOT NULL UNIQUE,
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(120) NOT NULL,
    subject VARCHAR(255) NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    details TEXT NOT NULL DEFAULT '',
    complaint_channel VARCHAR(50) NOT NULL DEFAULT 'Portal',
    requested_remedy TEXT NULL,
    stage_key_at_filing VARCHAR(80) NOT NULL DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'Filed',
    filed_by VARCHAR(255) NULL,
    filed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    assigned_to VARCHAR(255) NULL,
    reviewed_by VARCHAR(255) NULL,
    reviewed_at TIMESTAMP WITHOUT TIME ZONE NULL,
    resolution_outcome VARCHAR(120) NULL,
    resolution_stage_key VARCHAR(80) NULL,
    resolution_notes TEXT NULL,
    resolved_at TIMESTAMP WITHOUT TIME ZONE NULL,
    parent_record_title VARCHAR(255) NULL,
    parent_current_stage_key VARCHAR(80) NULL,
    parent_current_stage_title VARCHAR(160) NULL,
    parent_current_status VARCHAR(80) NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_administrative_reviews_entity
    ON procurement_workflow.administrative_reviews (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_administrative_reviews_status
    ON procurement_workflow.administrative_reviews (status);

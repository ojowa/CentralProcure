CREATE TABLE IF NOT EXISTS procurement_workflow.administrative_reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(120) NOT NULL,
    entity_title VARCHAR(255) NOT NULL DEFAULT '',
    review_type VARCHAR(80) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Pending',
    comments TEXT NOT NULL DEFAULT '',
    justification TEXT NOT NULL DEFAULT '',
    reviewed_by VARCHAR(255) NULL,
    reviewed_at TIMESTAMP NULL,
    filing_number VARCHAR(80) NULL,
    filing_date TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_administrative_reviews_entity
    ON procurement_workflow.administrative_reviews (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_administrative_reviews_status
    ON procurement_workflow.administrative_reviews (status);

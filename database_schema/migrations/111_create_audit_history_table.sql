-- Migration 111: Create post_award.audit_history table

BEGIN;

CREATE TABLE IF NOT EXISTS post_award.audit_history (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    action VARCHAR(120) NOT NULL,
    performed_by VARCHAR(255) NULL,
    old_values JSONB NULL,
    new_values JSONB NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_history_entity
    ON post_award.audit_history (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_history_action
    ON post_award.audit_history (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_history_performed_by
    ON post_award.audit_history (performed_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_history_created
    ON post_award.audit_history (created_at DESC);

COMMIT;

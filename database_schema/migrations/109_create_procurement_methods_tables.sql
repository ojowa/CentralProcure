-- Migration 109: Create procurement_methods and method_exceptions tables
-- These tables are referenced by the procurement-methods.ts API route but were never created.

BEGIN;

-- ============================================================
-- 1. procurement_workflow.procurement_methods
-- ============================================================
CREATE TABLE IF NOT EXISTS procurement_workflow.procurement_methods (
    method_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID NOT NULL,
    entity_title VARCHAR(255) NOT NULL DEFAULT '',
    method_determined VARCHAR(40) NOT NULL,
    estimated_value NUMERIC(15,2) NOT NULL DEFAULT 0,
    justification TEXT NOT NULL DEFAULT '',
    status VARCHAR(40) NOT NULL DEFAULT 'Determined',
    determined_by VARCHAR(255) NULL,
    determined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT procurement_methods_entity_uniq UNIQUE (entity_type, entity_id),
    CONSTRAINT procurement_methods_method_chk
        CHECK (method_determined IN ('CompetitiveTender', 'SimplifiedQuotation', 'DirectProcurement', 'ForceAccount')),
    CONSTRAINT procurement_methods_status_chk
        CHECK (status IN ('Determined', 'Overridden', 'Superseded'))
);

CREATE INDEX IF NOT EXISTS idx_procurement_methods_entity
    ON procurement_workflow.procurement_methods (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_procurement_methods_status
    ON procurement_workflow.procurement_methods (status, created_at DESC);

-- ============================================================
-- 2. procurement_workflow.method_exceptions
-- ============================================================
CREATE TABLE IF NOT EXISTS procurement_workflow.method_exceptions (
    exception_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID NOT NULL,
    entity_title VARCHAR(255) NOT NULL DEFAULT '',
    requested_method VARCHAR(40) NOT NULL,
    justification TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    status VARCHAR(40) NOT NULL DEFAULT 'Pending',
    requested_by VARCHAR(255) NULL,
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_by VARCHAR(255) NULL,
    decided_at TIMESTAMP NULL,
    decision_comments TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT method_exceptions_requested_method_chk
        CHECK (requested_method IN ('CompetitiveTender', 'SimplifiedQuotation', 'DirectProcurement', 'ForceAccount')),
    CONSTRAINT method_exceptions_status_chk
        CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Returned'))
);

CREATE INDEX IF NOT EXISTS idx_method_exceptions_entity
    ON procurement_workflow.method_exceptions (entity_type, entity_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_method_exceptions_status
    ON procurement_workflow.method_exceptions (status, requested_at DESC);

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS procurement_workflow.procurement_method_decisions (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID NOT NULL,
    threshold_id UUID NULL,
    approval_route VARCHAR(120) NULL,
    selected_method VARCHAR(40) NOT NULL,
    decision_reason TEXT NOT NULL,
    determined_by VARCHAR(255) NULL,
    determined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_exception_decision BOOLEAN NOT NULL DEFAULT FALSE,
    superseded_by_decision_id UUID NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_procurement_method_decisions_threshold
        FOREIGN KEY (threshold_id)
        REFERENCES procurement_workflow.approval_thresholds(threshold_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_procurement_method_decisions_superseded
        FOREIGN KEY (superseded_by_decision_id)
        REFERENCES procurement_workflow.procurement_method_decisions(decision_id)
        ON DELETE SET NULL,
    CONSTRAINT procurement_method_decisions_method_chk
        CHECK (selected_method IN ('CompetitiveTender', 'SimplifiedQuotation'))
);

CREATE INDEX IF NOT EXISTS idx_procurement_method_decisions_entity
    ON procurement_workflow.procurement_method_decisions (entity_type, entity_id, determined_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_method_decisions_current
    ON procurement_workflow.procurement_method_decisions (entity_type, entity_id)
    WHERE superseded_by_decision_id IS NULL;

CREATE TABLE IF NOT EXISTS procurement_workflow.procurement_method_change_exceptions (
    exception_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID NOT NULL,
    current_method VARCHAR(40) NOT NULL,
    requested_method VARCHAR(40) NOT NULL,
    request_reason TEXT NOT NULL,
    requested_by VARCHAR(255) NULL,
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(40) NOT NULL DEFAULT 'PendingReview',
    cgis_note TEXT NULL,
    reviewed_by VARCHAR(255) NULL,
    reviewed_at TIMESTAMP NULL,
    prior_decision_id UUID NULL,
    resulting_decision_id UUID NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT procurement_method_change_exceptions_current_method_chk
        CHECK (current_method IN ('CompetitiveTender', 'SimplifiedQuotation')),
    CONSTRAINT procurement_method_change_exceptions_requested_method_chk
        CHECK (requested_method IN ('CompetitiveTender', 'SimplifiedQuotation')),
    CONSTRAINT procurement_method_change_exceptions_status_chk
        CHECK (status IN ('PendingReview', 'Approved', 'Rejected', 'ReturnedForClarification')),
    CONSTRAINT fk_procurement_method_change_exceptions_prior_decision
        FOREIGN KEY (prior_decision_id)
        REFERENCES procurement_workflow.procurement_method_decisions(decision_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_procurement_method_change_exceptions_resulting_decision
        FOREIGN KEY (resulting_decision_id)
        REFERENCES procurement_workflow.procurement_method_decisions(decision_id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_procurement_method_change_exceptions_entity
    ON procurement_workflow.procurement_method_change_exceptions (entity_type, entity_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_method_change_exceptions_status
    ON procurement_workflow.procurement_method_change_exceptions (status, requested_at DESC);

COMMIT;

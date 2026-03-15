-- Approval Thresholds Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.approval_thresholds (
    threshold_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procurement_type VARCHAR(50) NULL,
    min_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
    max_amount DECIMAL(18, 2) NULL,
    approval_route VARCHAR(80) NOT NULL,
    approval_authority_code VARCHAR(80) NOT NULL DEFAULT 'GENERIC_ROUTE',
    approval_authority_label VARCHAR(160) NOT NULL DEFAULT 'Threshold authority',
    requires_cgis_approval BOOLEAN NOT NULL DEFAULT FALSE,
    requires_board BOOLEAN NOT NULL DEFAULT FALSE,
    requires_bpp BOOLEAN NOT NULL DEFAULT FALSE,
    governance_body_id UUID NULL REFERENCES procurement_workflow.governance_bodies(body_id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Active',
    notes TEXT NULL,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'approval_thresholds_amount_chk'
          AND conrelid = 'procurement_workflow.approval_thresholds'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.approval_thresholds
            ADD CONSTRAINT approval_thresholds_amount_chk
            CHECK (min_amount >= 0 AND (max_amount IS NULL OR max_amount >= min_amount));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'approval_thresholds_status_chk'
          AND conrelid = 'procurement_workflow.approval_thresholds'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.approval_thresholds
            ADD CONSTRAINT approval_thresholds_status_chk
            CHECK (status IN ('Active', 'Inactive'));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS approval_thresholds_lookup_idx
    ON procurement_workflow.approval_thresholds (procurement_type, min_amount, max_amount, status);

CREATE INDEX IF NOT EXISTS approval_thresholds_governance_body_idx
    ON procurement_workflow.approval_thresholds (governance_body_id, status);

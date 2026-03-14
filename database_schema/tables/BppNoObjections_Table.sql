-- BPP No Objection Tracking Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS procurement_workflow.bpp_no_objections (
    no_objection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID NULL REFERENCES procurement_workflow.requisitions(requisition_id) ON DELETE SET NULL,
    tender_id UUID NULL REFERENCES vendor_sourcing.tenders(tender_id) ON DELETE SET NULL,
    amount DECIMAL(18, 2) NOT NULL,
    procurement_type VARCHAR(50) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Draft',
    requested_by VARCHAR(255) NULL,
    requested_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    decision_by VARCHAR(255) NULL,
    decision_at TIMESTAMP WITHOUT TIME ZONE NULL,
    decision_notes TEXT NULL,
    reference_code VARCHAR(80) NULL,
    created_by VARCHAR(255) DEFAULT CURRENT_USER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT CURRENT_USER,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bpp_no_objections_status_chk'
          AND conrelid = 'procurement_workflow.bpp_no_objections'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.bpp_no_objections
            ADD CONSTRAINT bpp_no_objections_status_chk
            CHECK (status IN ('Draft', 'Submitted', 'In Review', 'Approved', 'Rejected', 'Cancelled'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bpp_no_objections_source_chk'
          AND conrelid = 'procurement_workflow.bpp_no_objections'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.bpp_no_objections
            ADD CONSTRAINT bpp_no_objections_source_chk
            CHECK ((requisition_id IS NOT NULL) OR (tender_id IS NOT NULL));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS bpp_no_objections_requisition_idx
    ON procurement_workflow.bpp_no_objections (requisition_id);

CREATE INDEX IF NOT EXISTS bpp_no_objections_tender_idx
    ON procurement_workflow.bpp_no_objections (tender_id);

CREATE INDEX IF NOT EXISTS bpp_no_objections_status_idx
    ON procurement_workflow.bpp_no_objections (status);

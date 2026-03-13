-- Migration 016: APP Line Items, Threshold Routing, BPP No Objection, Tender Budget Fields (PostgreSQL)
BEGIN;

CREATE SCHEMA IF NOT EXISTS procurement_workflow;
CREATE SCHEMA IF NOT EXISTS vendor_sourcing;

-- APP line items for procurement plans
CREATE TABLE IF NOT EXISTS procurement_workflow.procurement_plan_items (
    plan_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES procurement_workflow.procurement_plans(plan_id) ON DELETE CASCADE,
    item_code VARCHAR(60) NULL,
    description TEXT NOT NULL,
    budget_code VARCHAR(60) NOT NULL,
    procurement_type VARCHAR(50) NULL,
    estimated_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
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
        WHERE conname = 'procurement_plan_items_amount_chk'
          AND conrelid = 'procurement_workflow.procurement_plan_items'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.procurement_plan_items
            ADD CONSTRAINT procurement_plan_items_amount_chk
            CHECK (estimated_amount >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'procurement_plan_items_status_chk'
          AND conrelid = 'procurement_workflow.procurement_plan_items'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.procurement_plan_items
            ADD CONSTRAINT procurement_plan_items_status_chk
            CHECK (status IN ('Active', 'Inactive', 'Cancelled'));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS procurement_plan_items_plan_idx
    ON procurement_workflow.procurement_plan_items (plan_id);

CREATE INDEX IF NOT EXISTS procurement_plan_items_budget_idx
    ON procurement_workflow.procurement_plan_items (budget_code);

CREATE UNIQUE INDEX IF NOT EXISTS procurement_plan_items_code_ux
    ON procurement_workflow.procurement_plan_items (plan_id, item_code)
    WHERE item_code IS NOT NULL;

-- Link requisitions to APP line items
ALTER TABLE procurement_workflow.requisitions
    ADD COLUMN IF NOT EXISTS app_item_id UUID NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'requisitions_app_item_fk'
          AND conrelid = 'procurement_workflow.requisitions'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.requisitions
            ADD CONSTRAINT requisitions_app_item_fk
            FOREIGN KEY (app_item_id)
            REFERENCES procurement_workflow.procurement_plan_items(plan_item_id)
            ON DELETE SET NULL;
    END IF;
END
$$;

-- Approval thresholds for routing and BPP prior review
CREATE TABLE IF NOT EXISTS procurement_workflow.approval_thresholds (
    threshold_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procurement_type VARCHAR(50) NULL,
    min_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
    max_amount DECIMAL(18, 2) NULL,
    approval_route VARCHAR(80) NOT NULL,
    requires_board BOOLEAN NOT NULL DEFAULT FALSE,
    requires_bpp BOOLEAN NOT NULL DEFAULT FALSE,
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

-- BPP No Objection tracking
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

-- Tender budget metadata for ledger validation
ALTER TABLE vendor_sourcing.tenders
    ADD COLUMN IF NOT EXISTS department VARCHAR(150) NULL,
    ADD COLUMN IF NOT EXISTS budget_code VARCHAR(60) NULL,
    ADD COLUMN IF NOT EXISTS fiscal_year INT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS budget_commitments_tender_active_ux
    ON procurement_workflow.budget_commitments (tender_id)
    WHERE tender_id IS NOT NULL AND status IN ('Reserved', 'Committed');

COMMIT;

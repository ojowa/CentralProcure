-- Migration 112: Create tender_evaluation_assignments + add evaluator_id to evaluation_reports
BEGIN;

-- 1. Add evaluator_id to evaluation_reports (references internal_users)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'procurement_workflow'
          AND table_name = 'evaluation_reports'
          AND column_name = 'evaluator_id'
    ) THEN
        ALTER TABLE procurement_workflow.evaluation_reports
            ADD COLUMN evaluator_id UUID NULL;
    END IF;
END
$$;

-- 2. Create tender_evaluation_assignments
CREATE TABLE IF NOT EXISTS procurement_workflow.tender_evaluation_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL,
    evaluator_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'evaluation_committee',
    status VARCHAR(50) NOT NULL DEFAULT 'Assigned',
    assignment_date TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Unique constraint: one assignment per evaluator per tender
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_tender_evaluator_assignment'
          AND conrelid = 'procurement_workflow.tender_evaluation_assignments'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.tender_evaluation_assignments
            ADD CONSTRAINT uq_tender_evaluator_assignment
            UNIQUE (tender_id, evaluator_id);
    END IF;
END
$$;

-- 4. Status check constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tender_evaluation_assignments_status_chk'
          AND conrelid = 'procurement_workflow.tender_evaluation_assignments'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.tender_evaluation_assignments
            ADD CONSTRAINT tender_evaluation_assignments_status_chk
            CHECK (status IN ('Assigned', 'In Progress', 'Completed', 'Withdrawn'));
    END IF;
END
$$;

-- 5. Role check constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tender_evaluation_assignments_role_chk'
          AND conrelid = 'procurement_workflow.tender_evaluation_assignments'::regclass
    ) THEN
        ALTER TABLE procurement_workflow.tender_evaluation_assignments
            ADD CONSTRAINT tender_evaluation_assignments_role_chk
            CHECK (role IN ('technical_evaluator', 'financial_evaluator', 'evaluation_committee'));
    END IF;
END
$$;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_tea_tender_id ON procurement_workflow.tender_evaluation_assignments(tender_id);
CREATE INDEX IF NOT EXISTS idx_tea_evaluator_id ON procurement_workflow.tender_evaluation_assignments(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_tea_status ON procurement_workflow.tender_evaluation_assignments(status);

COMMIT;

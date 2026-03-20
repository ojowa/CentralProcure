-- Migration 047: Budget Commitments link to appropriations
BEGIN;

ALTER TABLE procurement_workflow.budget_commitments
ADD COLUMN IF NOT EXISTS appropriation_id UUID REFERENCES procurement_workflow.budget_appropriations(appropriation_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS budget_commitments_appropriation_idx
    ON procurement_workflow.budget_commitments (appropriation_id);

COMMIT;

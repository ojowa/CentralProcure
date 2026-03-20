-- Migration 048: Fix Budget Commitments Source Constraint
BEGIN;

-- Drop the old constraint that required either requisition_id or tender_id
ALTER TABLE procurement_workflow.budget_commitments
DROP CONSTRAINT IF EXISTS budget_commitments_source_chk;

-- Add a new constraint that also allows appropriation_id as a valid source
-- A commitment must have at least one of these links to be valid
ALTER TABLE procurement_workflow.budget_commitments
ADD CONSTRAINT budget_commitments_source_chk
CHECK ((requisition_id IS NOT NULL) OR (tender_id IS NOT NULL) OR (appropriation_id IS NOT NULL));

COMMIT;

-- Add threshold_name and governance_body_name columns to approval_thresholds
-- These are referenced by the workflow configuration API but were never added to the table

ALTER TABLE procurement_workflow.approval_thresholds
  ADD COLUMN IF NOT EXISTS threshold_name VARCHAR(160) NULL;

ALTER TABLE procurement_workflow.approval_thresholds
  ADD COLUMN IF NOT EXISTS governance_body_name VARCHAR(160) NULL;

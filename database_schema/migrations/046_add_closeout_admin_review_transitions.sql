-- Migration 046: Add Missing Workflow Transitions for Closeout and Administrative Review
-- This migration adds transitions FROM closeout_and_audit and administrative_review stages
-- that were missing from the original workflow blueprint seed data

BEGIN;

-- Transitions FROM closeout_and_audit (terminal state - no outgoing transitions needed except reopen)
-- Note: closeout_and_audit is terminal (is_terminal = TRUE), but records can be reopened for audit
INSERT INTO procurement_workflow.workflow_stage_transitions (
    from_stage_key,
    to_stage_key,
    transition_condition
)
SELECT *
FROM (
    VALUES
        -- Administrative Review transitions back to main workflow
        ('administrative_review', 'solicitation', 'Complaint resolved and procurement resumes from solicitation.'),
        ('administrative_review', 'evaluation', 'Complaint resolved and procurement returns to evaluation.'),
        ('administrative_review', 'award_and_publication', 'Complaint resolved and procurement returns to award stage.'),
        ('administrative_review', 'bpp_no_objection', 'Complaint outcome escalates case for BPP prior review.'),
        ('administrative_review', 'closeout_and_audit', 'Complaint outcome terminates procurement and archives the file.'),
        -- Closeout can be reopened for audit purposes
        ('closeout_and_audit', 'contract_execution', 'Audit reopens closed record for investigation.'),
        ('closeout_and_audit', 'inspection_and_payment', 'Audit reopens record for payment review.')
) AS seed (from_stage_key, to_stage_key, transition_condition)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_stage_transitions existing
    WHERE existing.from_stage_key = seed.from_stage_key
      AND existing.to_stage_key = seed.to_stage_key
);

-- Add workflow role tasks for administrative_review if not present
INSERT INTO procurement_workflow.workflow_role_tasks (
    role_key,
    display_name,
    stage_key,
    task_description,
    expected_outcome
)
SELECT *
FROM (
    VALUES
        ('complaints_review_officer', 'Review Complaint', 'administrative_review', 'Review filed complaint and supporting evidence.', 'Complaint assigned and under review.'),
        ('complaints_review_officer', 'Resolve Complaint', 'administrative_review', 'Record resolution outcome and restore or terminate procurement.', 'Complaint resolved with documented outcome.'),
        ('accounting_officer', 'Adjudicate Complaint', 'administrative_review', 'Review CGIS-level complaint and decide remedy.', 'CGIS decision is recorded.'),
        ('bpp_reviewer', 'BPP Review Complaint', 'administrative_review', 'Review escalated complaint at BPP level.', 'BPP review outcome recorded.')
) AS seed (role_key, display_name, stage_key, task_description, expected_outcome)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_role_tasks existing
    WHERE existing.role_key = seed.role_key
      AND existing.stage_key = seed.stage_key
      AND existing.display_name = seed.display_name
);

-- Add workflow role tasks for closeout_and_audit if not present
INSERT INTO procurement_workflow.workflow_role_tasks (
    role_key,
    display_name,
    stage_key,
    task_description,
    expected_outcome
)
SELECT *
FROM (
    VALUES
        ('audit_oversight', 'Archive Record', 'closeout_and_audit', 'Complete closeout and archive procurement record.', 'Record archived with reference number.'),
        ('audit_oversight', 'Reopen for Audit', 'closeout_and_audit', 'Reopen closed record for compliance audit.', 'Record reopened with audit justification.'),
        ('admin', 'Audit Trail Review', 'closeout_and_audit', 'Review complete audit trail of procurement.', 'Audit trail verified and complete.')
) AS seed (role_key, display_name, stage_key, task_description, expected_outcome)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_role_tasks existing
    WHERE existing.role_key = seed.role_key
      AND existing.stage_key = seed.stage_key
      AND existing.display_name = seed.display_name
);

-- Ensure closeout workflow action grants exist for audit_oversight role
INSERT INTO procurement_workflow.workflow_action_grants (
    role_key,
    stage_key,
    action_key,
    grant_type
)
SELECT *
FROM (
    VALUES
        ('audit_oversight', 'closeout_and_audit', 'closeout.create', 'role_stage'),
        ('audit_oversight', 'closeout_and_audit', 'closeout.view', 'role_stage'),
        ('audit_oversight', 'closeout_and_audit', 'closeout.reopen', 'role_stage'),
        ('complaints_review_officer', 'administrative_review', 'administrative_review.create', 'role_stage'),
        ('complaints_review_officer', 'administrative_review', 'administrative_review.update', 'role_stage'),
        ('complaints_review_officer', 'administrative_review', 'administrative_review.resolve', 'role_stage'),
        ('accounting_officer', 'administrative_review', 'administrative_review.resolve', 'role_stage'),
        ('bpp_reviewer', 'administrative_review', 'administrative_review.resolve', 'role_stage')
) AS seed (role_key, stage_key, action_key, grant_type)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_action_grants existing
    WHERE existing.role_key = seed.role_key
      AND existing.stage_key = seed.stage_key
      AND existing.action_key = seed.action_key
);

COMMIT;

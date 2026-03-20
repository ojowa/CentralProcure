CREATE TABLE IF NOT EXISTS procurement_workflow.workflow_stage_catalog (
    stage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_key VARCHAR(80) NOT NULL UNIQUE,
    phase_key VARCHAR(80) NOT NULL,
    stage_title VARCHAR(160) NOT NULL,
    stage_description TEXT NOT NULL,
    sequence_no INTEGER NOT NULL,
    is_decision_gate BOOLEAN NOT NULL DEFAULT FALSE,
    is_start BOOLEAN NOT NULL DEFAULT FALSE,
    is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
    primary_owner_role VARCHAR(80) NOT NULL,
    ppa_reference VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_stage_catalog_phase_sequence
    ON procurement_workflow.workflow_stage_catalog (phase_key, sequence_no);

CREATE TABLE IF NOT EXISTS procurement_workflow.workflow_stage_transitions (
    transition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_stage_key VARCHAR(80) NOT NULL,
    to_stage_key VARCHAR(80) NOT NULL,
    transition_condition TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_workflow_transition_from
        FOREIGN KEY (from_stage_key)
        REFERENCES procurement_workflow.workflow_stage_catalog(stage_key)
        ON DELETE CASCADE,
    CONSTRAINT fk_workflow_transition_to
        FOREIGN KEY (to_stage_key)
        REFERENCES procurement_workflow.workflow_stage_catalog(stage_key)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflow_stage_transitions_from_stage
    ON procurement_workflow.workflow_stage_transitions (from_stage_key);

CREATE TABLE IF NOT EXISTS procurement_workflow.workflow_role_tasks (
    role_task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_key VARCHAR(80) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    stage_key VARCHAR(80) NOT NULL,
    task_description TEXT NOT NULL,
    expected_outcome TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_workflow_role_tasks_stage
        FOREIGN KEY (stage_key)
        REFERENCES procurement_workflow.workflow_stage_catalog(stage_key)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflow_role_tasks_role_stage
    ON procurement_workflow.workflow_role_tasks (role_key, stage_key);

INSERT INTO procurement_workflow.workflow_stage_catalog (
    stage_key,
    phase_key,
    stage_title,
    stage_description,
    sequence_no,
    is_decision_gate,
    is_start,
    is_terminal,
    primary_owner_role,
    ppa_reference
)
SELECT *
FROM (
    VALUES
        ('department_need_capture', 'app_planning', 'Department Need Capture', 'Requisitioning Officer drafts and submits the departmental need.', 1, FALSE, TRUE, FALSE, 'requisitioning_officer', 'PPA 2007 s.18'),
        ('department_head_endorsement', 'app_planning', 'Department Head Endorsement', 'Department Head endorses the departmental need before budget coding.', 2, FALSE, FALSE, FALSE, 'department_head', 'PPA 2007 s.18'),
        ('budget_code_allocation', 'app_planning', 'Budget Code Allocation', 'Allocate budget code only before committee review.', 3, TRUE, FALSE, FALSE, 'financial_unit_officer', 'PPA 2007 s.16, s.18'),
        ('comptroller_procurement_review', 'app_planning', 'Comptroller Procurement Review', 'Comptroller Procurement approves the request for Planning Committee review.', 4, FALSE, FALSE, FALSE, 'procurement_officer', 'PPA 2007 s.18, s.21'),
        ('planning_committee_review', 'app_planning', 'Planning Committee Review', 'Validate need, packaging, aggregation, and cost assumptions.', 5, FALSE, FALSE, FALSE, 'procurement_officer', 'PPA 2007 s.18, s.21'),
        ('budget_confirmation', 'app_planning', 'Budget Final Confirmation', 'Confirm appropriation, affordability, and funding readiness.', 6, TRUE, FALSE, FALSE, 'financial_unit_officer', 'PPA 2007 s.16, s.18'),
        ('app_approval', 'app_planning', 'APP Approval', 'Approve the annual procurement plan for execution.', 7, TRUE, FALSE, FALSE, 'accounting_officer', 'PPA 2007 s.16, s.18'),
        ('procurement_initiation', 'threshold_control', 'Procurement Initiation', 'Activate an approved APP line for execution.', 8, FALSE, FALSE, FALSE, 'procurement_officer', 'PPA 2007 s.16, s.19'),
        ('threshold_resolution', 'threshold_control', 'Threshold Resolution', 'Resolve approval route, board gate, and BPP need.', 9, TRUE, FALSE, FALSE, 'procurement_manager', 'PPA 2007 s.16, s.17'),
        ('method_validation', 'threshold_control', 'Method Validation', 'Confirm the lawful procurement method and route.', 10, TRUE, FALSE, FALSE, 'legal_reviewer', 'PPA 2007 s.24-s.52'),
        ('solicitation', 'procurement_execution', 'Advert / Invitation / EOI / RFP', 'Publish advert or issue invitations/EOI/RFP.', 11, FALSE, FALSE, FALSE, 'procurement_officer', 'PPA 2007 s.19, s.25, s.44-s.48'),
        ('bid_opening', 'procurement_execution', 'Bid Opening', 'Record public opening and attendance.', 12, FALSE, FALSE, FALSE, 'procurement_officer', 'PPA 2007 s.30'),
        ('evaluation', 'procurement_execution', 'Evaluation', 'Evaluate against published criteria only.', 13, FALSE, FALSE, FALSE, 'evaluation_committee', 'PPA 2007 s.31-s.33, s.49-s.52'),
        ('tenders_board_review', 'procurement_execution', 'Tenders Board Review', 'Board review of evaluation recommendation.', 14, TRUE, FALSE, FALSE, 'tenders_board', 'PPA 2007 s.17, s.19, s.22'),
        ('accounting_officer_review', 'procurement_execution', 'CGIS Approval', 'Accounting officer final accountable gate.', 15, TRUE, FALSE, FALSE, 'accounting_officer', 'PPA 2007 s.16, s.20'),
        ('bpp_no_objection', 'procurement_execution', 'BPP No Objection', 'Prior review and no-objection gate for applicable thresholds.', 16, TRUE, FALSE, FALSE, 'bpp_liaison', 'PPA 2007 s.16, s.19'),
        ('award_and_publication', 'post_award', 'Award and Publication', 'Issue award notice and publish award record.', 17, FALSE, FALSE, FALSE, 'procurement_officer', 'PPA 2007 s.19, s.33'),
        ('contract_execution', 'post_award', 'Contract Execution', 'Manage contract signing, security, mobilisation, and milestones.', 18, FALSE, FALSE, FALSE, 'contract_manager', 'PPA 2007 s.35-s.37'),
        ('inspection_and_payment', 'post_award', 'Inspection and Payment', 'Record inspection, acceptance, and payment readiness.', 19, FALSE, FALSE, FALSE, 'inspection_officer', 'PPA 2007 s.19, s.37'),
        ('closeout_and_audit', 'review_and_oversight', 'Closeout and Audit', 'Archive records, complete closeout, and preserve audit trace.', 20, FALSE, FALSE, TRUE, 'audit_oversight', 'PPA 2007 s.16, s.38'),
        ('administrative_review', 'review_and_oversight', 'Administrative Review', 'Handle bidder complaint and statutory review path.', 21, FALSE, FALSE, FALSE, 'complaints_review_officer', 'PPA 2007 s.54')
) AS seed (
    stage_key,
    phase_key,
    stage_title,
    stage_description,
    sequence_no,
    is_decision_gate,
    is_start,
    is_terminal,
    primary_owner_role,
    ppa_reference
)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_stage_catalog existing
    WHERE existing.stage_key = seed.stage_key
);

INSERT INTO procurement_workflow.workflow_stage_transitions (
    from_stage_key,
    to_stage_key,
    transition_condition
)
SELECT *
FROM (
    VALUES
        ('department_need_capture', 'department_head_endorsement', 'Requisition officer submits departmental need for endorsement.'),
        ('department_head_endorsement', 'budget_code_allocation', 'Department Head endorsement completed.'),
        ('budget_code_allocation', 'comptroller_procurement_review', 'Budget code allocated for planning review.'),
        ('comptroller_procurement_review', 'planning_committee_review', 'Comptroller Procurement approves for committee review.'),
        ('planning_committee_review', 'budget_confirmation', 'Committee review complete and routed for final budget confirmation.'),
        ('budget_confirmation', 'app_approval', 'Final budget confirmation complete.'),
        ('app_approval', 'procurement_initiation', 'Approved APP line activated.'),
        ('procurement_initiation', 'threshold_resolution', 'Procurement request created.'),
        ('threshold_resolution', 'method_validation', 'Threshold route resolved.'),
        ('method_validation', 'solicitation', 'Method validated and approved.'),
        ('solicitation', 'bid_opening', 'Submission deadline reached.'),
        ('bid_opening', 'evaluation', 'Opening completed and minutes recorded.'),
        ('evaluation', 'tenders_board_review', 'Evaluation report submitted.'),
        ('tenders_board_review', 'accounting_officer_review', 'Escalation or accounting officer gate required.'),
        ('tenders_board_review', 'award_and_publication', 'Board approval is sufficient within threshold.'),
        ('accounting_officer_review', 'bpp_no_objection', 'BPP prior review required.'),
        ('accounting_officer_review', 'award_and_publication', 'BPP prior review not required.'),
        ('bpp_no_objection', 'award_and_publication', 'No-objection issued.'),
        ('award_and_publication', 'contract_execution', 'Contract signed.'),
        ('contract_execution', 'inspection_and_payment', 'Milestone or delivery ready for inspection.'),
        ('inspection_and_payment', 'closeout_and_audit', 'Final acceptance and payment complete.'),
        ('solicitation', 'administrative_review', 'Complaint filed.'),
        ('evaluation', 'administrative_review', 'Complaint filed.'),
        ('award_and_publication', 'administrative_review', 'Complaint filed.')
) AS seed (from_stage_key, to_stage_key, transition_condition)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_stage_transitions existing
    WHERE existing.from_stage_key = seed.from_stage_key
      AND existing.to_stage_key = seed.to_stage_key
      AND existing.transition_condition = seed.transition_condition
);

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
        ('requisitioning_officer', 'Requisitioning Officer', 'department_need_capture', 'Create and submit the departmental request.', 'Department request is logged for endorsement.'),
        ('department_head', 'Department Head', 'department_head_endorsement', 'Endorse the departmental request.', 'Department endorsement is recorded.'),
        ('financial_unit_officer', 'Budget Officer', 'budget_code_allocation', 'Allocate budget code for the request.', 'Budget code is assigned.'),
        ('procurement_officer', 'Comptroller Procurement', 'comptroller_procurement_review', 'Approve the request for Planning Committee review.', 'Request is approved for committee consideration.'),
        ('planning_statistics_officer', 'Planning, Research and Statistics', 'planning_committee_review', 'Review demand timing and aggregation logic.', 'APP package is planning-compliant.'),
        ('financial_unit_officer', 'Financial Unit', 'budget_confirmation', 'Confirm appropriation and affordability.', 'Budget gate is passed or blocked with reasons.'),
        ('procurement_officer', 'Procurement Officer', 'procurement_initiation', 'Open procurement package from approved APP line.', 'Execution begins only from approved APP entries.'),
        ('procurement_manager', 'Procurement Manager', 'threshold_resolution', 'Validate threshold band and approval route.', 'Approval path and BPP gate are explicit.'),
        ('legal_reviewer', 'Legal Reviewer', 'method_validation', 'Confirm lawful procurement method and exceptions.', 'Method is compliant with the Act.'),
        ('procurement_officer', 'Procurement Officer', 'solicitation', 'Publish advert or issue invitations.', 'Solicitation is opened lawfully.'),
        ('evaluation_committee', 'Evaluation Committee', 'evaluation', 'Consolidate evaluation findings into report.', 'Recommendation is ready for approval.'),
        ('tenders_board_secretary', 'Tenders Board Secretary', 'tenders_board_review', 'Prepare board papers and record decision.', 'Board output is documented and traceable.'),
        ('tenders_board', 'Immigration Tender Board', 'tenders_board_review', 'Approve, reject, or escalate recommendation.', 'Decision is recorded with rationale.'),
        ('accounting_officer', 'Accounting Officer', 'accounting_officer_review', 'Exercise accountable approval gate.', 'High-value or escalated case is cleared or stopped.'),
        ('bpp_liaison', 'BPP Liaison', 'bpp_no_objection', 'Prepare and submit prior-review pack.', 'BPP request is complete and traceable.'),
        ('bpp_reviewer', 'BPP Reviewer', 'bpp_no_objection', 'Record BPP review result and remarks.', 'No-objection outcome is captured.'),
        ('contract_manager', 'Contract Manager', 'contract_execution', 'Manage milestones, guarantees, and variations.', 'Contract is executed under control.'),
        ('inspection_officer', 'Inspection Officer', 'inspection_and_payment', 'Verify delivery and acceptance evidence.', 'Payment readiness is supported by inspection.'),
        ('payment_officer', 'Payment Officer', 'inspection_and_payment', 'Track payment readiness and release path.', 'Disbursement is tied to acceptance.'),
        ('audit_oversight', 'Audit and Oversight', 'closeout_and_audit', 'Review closeout pack and audit trail.', 'Procurement file is ready for oversight.'),
        ('complaints_review_officer', 'Administrative Review Officer', 'administrative_review', 'Handle complaint and record remedy path.', 'Section 54 review path is tracked.')
) AS seed (role_key, display_name, stage_key, task_description, expected_outcome)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_role_tasks existing
    WHERE existing.role_key = seed.role_key
      AND existing.stage_key = seed.stage_key
      AND existing.task_description = seed.task_description
);

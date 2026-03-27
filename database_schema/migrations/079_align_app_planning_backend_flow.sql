BEGIN;

DELETE FROM procurement_workflow.workflow_stage_transitions
WHERE from_stage_key = 'budget_code_allocation'
  AND to_stage_key = 'planning_committee_review';

INSERT INTO procurement_workflow.workflow_role_tasks (
    role_key,
    display_name,
    stage_key,
    task_description,
    expected_outcome
)
SELECT
    src.role_key,
    src.display_name,
    src.stage_key,
    src.task_description,
    src.expected_outcome
FROM (
    VALUES
        ('financial_unit_officer', 'Financial Unit Officer', 'planning_committee_review', 'Review funding alignment and confirm budget integrity within the committee.', 'Funding position is confirmed for committee review.'),
        ('department_head', 'Department Head', 'planning_committee_review', 'Confirm the originating department''s operational justification during committee review.', 'Department need remains justified at committee stage.'),
        ('legal_reviewer', 'Legal Reviewer', 'planning_committee_review', 'Review legal compliance of the requisition package before APP approval.', 'Committee record includes legal compliance view.'),
        ('procurement_secretary', 'Procurement Secretary', 'planning_committee_review', 'Record committee deliberations and maintain the planning committee trail.', 'Committee proceedings are properly recorded.'),
        ('accounting_officer', 'CGIS', 'app_approval', 'Provide Comptroller General of Immigration Service concurrence before the APP is released for execution.', 'APP approval includes CGIS control.')
) AS src(role_key, display_name, stage_key, task_description, expected_outcome)
WHERE NOT EXISTS (
    SELECT 1
    FROM procurement_workflow.workflow_role_tasks existing
    WHERE existing.role_key = src.role_key
      AND existing.stage_key = src.stage_key
);

CREATE OR REPLACE FUNCTION procurement_workflow.resolve_requisition_stage(p_status VARCHAR(50))
RETURNS VARCHAR(60)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN CASE
        WHEN p_status IS NULL THEN 'department_need_capture'
        WHEN p_status ILIKE 'Draft' THEN 'department_need_capture'
        WHEN p_status ILIKE 'Submitted' THEN 'department_head_endorsement'
        WHEN p_status ILIKE 'Endorsed' THEN 'budget_code_allocation'
        WHEN p_status ILIKE 'Initial' THEN 'comptroller_procurement_review'
        WHEN p_status ILIKE 'Under Review' THEN 'planning_committee_review'
        WHEN p_status ILIKE 'Evaluation' THEN 'evaluation'
        WHEN p_status ILIKE 'Board Review' THEN 'tenders_board_review'
        WHEN p_status ILIKE 'Approved' THEN 'accounting_officer_review'
        WHEN p_status ILIKE 'Rejected' THEN 'department_need_capture'
        ELSE 'department_need_capture'
    END;
END;
$$;

UPDATE procurement_workflow.workflow_instances wi
SET current_stage_key = CASE
        WHEN r.status = 'Draft' THEN 'department_need_capture'
        WHEN r.status = 'Submitted' THEN 'department_head_endorsement'
        WHEN r.status = 'Endorsed' THEN 'budget_code_allocation'
        WHEN r.status = 'Initial' THEN 'comptroller_procurement_review'
        WHEN r.status = 'Under Review' THEN 'planning_committee_review'
        WHEN r.status = 'Evaluation' THEN 'evaluation'
        WHEN r.status = 'Board Review' THEN 'tenders_board_review'
        WHEN r.status = 'Approved' THEN 'accounting_officer_review'
        WHEN r.status = 'Rejected' THEN 'department_need_capture'
        ELSE wi.current_stage_key
    END,
    current_status = r.status,
    last_transition_reason = 'APP planning workflow alignment migration 079.',
    updated_at = NOW()
FROM procurement_workflow.requisitions r
WHERE wi.entity_type = 'requisition'
  AND wi.entity_id = r.requisition_id;

COMMIT;

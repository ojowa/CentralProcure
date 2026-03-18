-- Migration 039: Align CGIS chairmanship and Comptroller Procurement labels

UPDATE procurement_workflow.workflow_stage_catalog
SET stage_description = 'NIS Tenders Board review chaired by CGIS, with the board secretary maintaining the decision record.'
WHERE stage_key = 'tenders_board_review';

UPDATE procurement_workflow.workflow_role_tasks
SET display_name = 'Comptroller Procurement'
WHERE role_key = 'procurement_officer';

UPDATE procurement_workflow.workflow_role_tasks
SET task_description = 'Prepare board papers and record the decision log for the NIS Tenders Board chaired by CGIS.'
WHERE role_key = 'tenders_board_secretary'
  AND stage_key = 'tenders_board_review';

UPDATE procurement_workflow.workflow_role_tasks
SET task_description = 'Approve, reject, or endorse recommendation for BPP prior review under the chairmanship of CGIS.'
WHERE role_key = 'tenders_board'
  AND stage_key = 'tenders_board_review';

UPDATE procurement_workflow.governance_bodies
SET description = 'NIS Tenders Board chaired by CGIS, with the Procurement unit serving board secretariat support.'
WHERE body_name = 'NIS Tenders Board';

UPDATE procurement_workflow.approval_thresholds
SET approval_authority_label = CASE
        WHEN requires_bpp = FALSE AND requires_board = TRUE THEN 'NIS Tenders Board (Chair: CGIS)'
        WHEN requires_bpp = TRUE AND requires_board = TRUE THEN 'NIS Tenders Board + BPP No Objection'
        ELSE approval_authority_label
    END,
    notes = CASE
        WHEN requires_bpp = FALSE AND requires_board = TRUE THEN 'Board-value procurement routed to the NIS Tenders Board chaired by CGIS for final internal decision.'
        WHEN requires_bpp = TRUE AND requires_board = TRUE THEN 'High-value procurement requires NIS Tenders Board endorsement chaired by CGIS before BPP no-objection.'
        ELSE notes
    END
WHERE requires_board = TRUE;

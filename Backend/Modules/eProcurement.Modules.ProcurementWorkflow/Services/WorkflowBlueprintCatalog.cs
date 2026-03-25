using eProcurement.Modules.ProcurementWorkflow.DTOs;

namespace eProcurement.Modules.ProcurementWorkflow.Services;

internal static class WorkflowBlueprintCatalog
{
    private static readonly WorkflowPhaseResult[] Phases =
    [
        new("app_planning", "APP Planning", "Need capture, committee review, and APP approval.", 1),
        new("threshold_control", "Threshold Control", "CGIS, Tenders Board, BPP gate, and procurement method validation.", 2),
        new("procurement_execution", "Procurement Execution", "Advert/invitation, opening, evaluation, and approval routing.", 3),
        new("post_award", "Post-Award", "Award publication, contract delivery, inspection, and payment controls.", 4),
        new("review_and_oversight", "Review and Oversight", "Complaints, closeout, and audit traceability.", 5)
    ];

    private static readonly WorkflowStateResult[] States =
    [
        new("department_need_capture", "app_planning", "Department Need Capture", "Requisitioning Officer drafts and submits the departmental need.", 1, false, true, false, "PPA 2007 s.18", ["requisitioning_officer"], ["app.draft", "app.submit"]),
        new("department_head_endorsement", "app_planning", "Department Head Endorsement", "Department Head endorses the departmental need before budget coding.", 2, false, false, false, "PPA 2007 s.18", ["department_head"], ["app.submit"]),
        new("budget_code_allocation", "app_planning", "Budget Code Allocation", "Allocate budget code only before committee review.", 3, true, false, false, "PPA 2007 s.16, s.18", ["financial_unit_officer"], ["budget.confirm"]),
        new("comptroller_procurement_review", "app_planning", "Comptroller Procurement Review", "Comptroller Procurement approves the request for Planning Committee review.", 4, false, false, false, "PPA 2007 s.18, s.21", ["comptroller_procurement"], ["app.review"]),
        new("planning_committee_review", "app_planning", "Planning Committee Review", "Validate need, packaging, aggregation, and cost assumptions.", 5, false, false, false, "PPA 2007 s.18, s.21", ["comptroller_procurement", "planning_statistics_officer", "financial_unit_officer", "department_head", "legal_reviewer", "procurement_secretary"], ["app.review"]),
        new("app_approval", "app_planning", "APP Approval", "Approve the annual procurement plan and release it for execution.", 6, true, false, false, "PPA 2007 s.16, s.18", ["comptroller_procurement", "accounting_officer"], ["app.approve"]),
        new("procurement_initiation", "threshold_control", "Procurement Initiation", "Create a live procurement package from an approved APP line.", 7, false, false, false, "PPA 2007 s.16, s.19", ["requisitioning_officer", "comptroller_procurement"], ["procurement.initiate"]),
        new("threshold_resolution", "threshold_control", "Threshold Resolution", "Resolve the CGIS, Board, or BPP approval path for the procurement package.", 8, true, false, false, "PPA 2007 s.16, s.17", ["comptroller_procurement"], ["threshold.resolve"]),
        new("method_validation", "threshold_control", "Method Validation", "Validate open bidding by default and record any lawful exception.", 9, true, false, false, "PPA 2007 s.24-s.52", ["comptroller_procurement", "legal_reviewer"], ["method.validate"]),
        new("solicitation", "procurement_execution", "Advert / Invitation / EOI / RFP", "Publish advert, invitation, EOI, or RFP in the lawful format.", 10, false, false, false, "PPA 2007 s.19, s.25, s.44-s.48", ["comptroller_procurement"], ["solicitation.publish"]),
        new("bid_opening", "procurement_execution", "Bid Opening", "Record public opening, attendance, and bid totals.", 11, false, false, false, "PPA 2007 s.30", ["comptroller_procurement", "evaluation_committee"], ["bid_opening.record"]),
        new("evaluation", "procurement_execution", "Evaluation", "Evaluate only against the published criteria and issue recommendation.", 12, false, false, false, "PPA 2007 s.31-s.33, s.49-s.52", ["technical_evaluator", "financial_evaluator", "evaluation_committee"], ["evaluation.score", "evaluation.report"]),
        new("tenders_board_review", "procurement_execution", "Tenders Board Review", "NIS Tenders Board review chaired by CGIS, with the board secretary maintaining the decision record.", 13, true, false, false, "PPA 2007 s.17, s.19, s.22", ["tenders_board", "tenders_board_secretary"], ["approval.review", "approval.decide"]),
        new("accounting_officer_review", "procurement_execution", "CGIS Approval", "CGIS exercises the direct low-value approval authority before award publication.", 14, true, false, false, "PPA 2007 s.16, s.20", ["accounting_officer"], ["accounting_officer.decide"]),
        new("bpp_no_objection", "procurement_execution", "BPP No Objection", "Submit and track the prior-review no-objection process when required.", 15, true, false, false, "PPA 2007 s.16, s.19", ["bpp_liaison", "bpp_reviewer"], ["bpp.submit", "bpp.review"]),
        new("award_and_publication", "post_award", "Award and Publication", "Notify outcome, debrief on request, and publish award.", 16, false, false, false, "PPA 2007 s.19, s.33", ["comptroller_procurement"], ["award.publish"]),
        new("contract_execution", "post_award", "Contract Execution", "Track contract signing, security, mobilisation, milestones, and variations.", 17, false, false, false, "PPA 2007 s.35-s.37", ["contract_manager", "comptroller_procurement"], ["contract.manage"]),
        new("inspection_and_payment", "post_award", "Inspection and Payment", "Verify delivery, acceptance, and payment readiness.", 18, false, false, false, "PPA 2007 s.19, s.37", ["inspection_officer", "payment_officer"], ["inspection.record", "payment.track"]),
        new("closeout_and_audit", "review_and_oversight", "Closeout and Audit", "Close the procurement file and preserve the audit record.", 19, false, false, true, "PPA 2007 s.16, s.38", ["audit_oversight", "admin"], ["closeout.archive"]),
        new("administrative_review", "review_and_oversight", "Administrative Review", "Handle bidder complaints and statutory review paths.", 20, false, false, false, "PPA 2007 s.54", ["complaints_review_officer", "accounting_officer", "bpp_reviewer"], ["complaint.review"])
    ];

    private static readonly WorkflowTransitionResult[] Transitions =
    [
        new("department_need_capture", "department_head_endorsement", "Requisition officer submits departmental need for endorsement."),
        new("department_head_endorsement", "budget_code_allocation", "Department Head endorsement completed."),
        new("budget_code_allocation", "comptroller_procurement_review", "Budget code allocated for planning review."),
        new("comptroller_procurement_review", "planning_committee_review", "Comptroller Procurement approves for committee review."),
        new("planning_committee_review", "app_approval", "Committee review complete and routed for APP approval."),
        new("app_approval", "procurement_initiation", "Approved APP line is activated."),
        new("procurement_initiation", "threshold_resolution", "Live procurement request has been created."),
        new("threshold_resolution", "method_validation", "Threshold route and approval path have been resolved."),
        new("method_validation", "solicitation", "Method is lawful and approved."),
        new("solicitation", "bid_opening", "Submission period closes."),
        new("bid_opening", "evaluation", "Opening record is complete."),
        new("evaluation", "accounting_officer_review", "CGIS direct approval applies within low-value threshold."),
        new("evaluation", "tenders_board_review", "Board review applies within board or BPP threshold."),
        new("tenders_board_review", "award_and_publication", "Board approval is final within threshold."),
        new("tenders_board_review", "bpp_no_objection", "BPP prior review applies after board endorsement."),
        new("accounting_officer_review", "award_and_publication", "CGIS direct approval is complete."),
        new("bpp_no_objection", "award_and_publication", "No-objection is issued."),
        new("award_and_publication", "contract_execution", "Contract has been signed."),
        new("contract_execution", "inspection_and_payment", "Milestone or delivery is ready for inspection."),
        new("inspection_and_payment", "closeout_and_audit", "Final acceptance and payment are complete."),
        new("solicitation", "administrative_review", "A complaint has been filed."),
        new("evaluation", "administrative_review", "A complaint has been filed."),
        new("award_and_publication", "administrative_review", "A complaint has been filed.")
    ];

    private static readonly WorkflowRoleTaskResult[] RoleTasks =
    [
        new("requisitioning_officer", "Requisitioning Officer", "department_need_capture", "Create and submit the departmental request.", "Department request is logged for endorsement."),
        new("department_head", "Department Head", "department_head_endorsement", "Endorse the departmental request.", "Department endorsement is recorded."),
        new("financial_unit_officer", "Budget Officer", "budget_code_allocation", "Allocate budget code for the request.", "Budget code is assigned."),
        new("comptroller_procurement", "Comptroller Procurement", "comptroller_procurement_review", "Approve the request for Planning Committee review.", "Request is approved for committee consideration."),
        new("planning_statistics_officer", "Planning, Research and Statistics", "planning_committee_review", "Validate aggregation, sequencing, and annual planning assumptions.", "Planning package is coherent."),
        new("financial_unit_officer", "Financial Unit Officer", "planning_committee_review", "Review funding alignment and confirm budget integrity within the committee.", "Funding position is confirmed for committee review."),
        new("department_head", "Department Head", "planning_committee_review", "Confirm the originating department's operational justification during committee review.", "Department need remains justified at committee stage."),
        new("legal_reviewer", "Legal Reviewer", "planning_committee_review", "Review legal compliance of the requisition package before APP approval.", "Committee record includes legal compliance view."),
        new("procurement_secretary", "Procurement Secretary", "planning_committee_review", "Record committee deliberations and maintain the planning committee trail.", "Committee proceedings are properly recorded."),
        new("comptroller_procurement", "Comptroller Procurement", "app_approval", "Approve the annual procurement plan as head of the procurement unit.", "APP is approved for execution."),
        new("accounting_officer", "Accounting Officer", "app_approval", "Provide finance-side concurrence before the APP is released for execution.", "APP approval includes accounting control."),
        new("comptroller_procurement", "Comptroller Procurement", "procurement_initiation", "Open a procurement package from an approved APP line as head of the procurement unit.", "Execution stays tied to APP control."),
        new("comptroller_procurement", "Comptroller Procurement", "threshold_resolution", "Resolve whether the case falls to CGIS, the NIS Tenders Board, or BPP prior review as head of the procurement unit.", "Approval path and external review trigger are explicit."),
        new("comptroller_procurement", "Comptroller Procurement", "method_validation", "Approve the validated procurement method and authorize movement to solicitation.", "Method validation is accepted and the tender can proceed to publication."),
        new("legal_reviewer", "Legal Reviewer", "method_validation", "Validate lawful procurement method and exceptions.", "Method choice is compliant."),
        new("comptroller_procurement", "Comptroller Procurement", "solicitation", "Publish advert, invitation, EOI, or RFP using the required route.", "Competition is opened lawfully through the approved publication route."),
        new("technical_evaluator", "Technical Evaluator", "evaluation", "Perform technical scoring.", "Technical responsiveness is assessed."),
        new("financial_evaluator", "Financial Evaluator", "evaluation", "Perform arithmetic and financial review.", "Commercial comparison is accurate."),
        new("evaluation_committee", "Evaluation Committee", "evaluation", "Issue consolidated recommendation.", "Approval pack is ready."),
        new("tenders_board_secretary", "Tenders Board Secretary", "tenders_board_review", "Prepare board papers and record the decision log for the NIS Tenders Board chaired by CGIS.", "Board traceability is complete."),
        new("tenders_board", "NIS Tenders Board", "tenders_board_review", "Approve, reject, or endorse recommendation for BPP prior review under the chairmanship of CGIS.", "Board decision is recorded with governance rationale."),
        new("accounting_officer", "CGIS", "accounting_officer_review", "Exercise direct low-value approval authority.", "CGIS decision is recorded before award publication."),
        new("bpp_liaison", "BPP Liaison", "bpp_no_objection", "Submit prior-review pack to BPP.", "Regulatory submission is complete."),
        new("bpp_reviewer", "BPP Reviewer", "bpp_no_objection", "Record BPP outcome and queries.", "No-objection status is traceable."),
        new("comptroller_procurement", "Comptroller Procurement", "award_and_publication", "Issue award notice and publication.", "Award is legally communicated."),
        new("contract_manager", "Contract Manager", "contract_execution", "Track performance security, milestones, and variations.", "Contract is controlled post-award."),
        new("inspection_officer", "Inspection Officer", "inspection_and_payment", "Record inspection and acceptance.", "Payment readiness is evidence-backed."),
        new("payment_officer", "Payment Officer", "inspection_and_payment", "Track payment path after acceptance.", "Disbursement stays controlled."),
        new("audit_oversight", "Audit and Oversight", "closeout_and_audit", "Review closeout pack and audit trail.", "File is ready for oversight."),
        new("complaints_review_officer", "Administrative Review Officer", "administrative_review", "Manage complaint workflow under Section 54.", "Complaint path is traceable and timely.")
    ];

    private static readonly string[] DatabaseTables =
    [
        "procurement_workflow.procurement_plans",
        "procurement_workflow.procurement_plan_items",
        "procurement_workflow.approval_thresholds",
        "identity.organizational_positions",
        "procurement_workflow.governance_bodies",
        "procurement_workflow.governance_body_memberships",
        "procurement_workflow.requisitions",
        "procurement_workflow.tenders",
        "procurement_workflow.bid_opening_sessions",
        "procurement_workflow.evaluation_reports",
        "procurement_workflow.bpp_no_objections",
        "procurement_workflow.contract_awards",
        "procurement_workflow.contracts",
        "procurement_workflow.inspections",
        "procurement_workflow.budget_commitments",
        "procurement_workflow.workflow_stage_catalog",
        "procurement_workflow.workflow_stage_transitions",
        "procurement_workflow.workflow_role_tasks"
    ];

    public static IReadOnlyList<WorkflowPhaseResult> GetPhases() => Phases;

    public static IReadOnlyList<WorkflowStateResult> GetStates() => States;

    public static IReadOnlyList<WorkflowTransitionResult> GetTransitions() => Transitions;

    public static IReadOnlyList<WorkflowRoleTaskResult> GetRoleTasks() => RoleTasks;

    public static WorkflowBlueprintResult Build(string? currentRole, IReadOnlyList<WorkflowThresholdBandResult> thresholds, string thresholdSource)
    {
        return new WorkflowBlueprintResult(
            "PPA 2007 Procurement Workflow Blueprint",
            "Unified APP, threshold, procurement execution, and review flow for the internal portal.",
            thresholdSource,
            currentRole,
            DatabaseTables,
            Phases,
            States,
            Transitions,
            RoleTasks,
            thresholds);
    }

    public static IReadOnlyList<WorkflowThresholdBandResult> GetFallbackThresholds()
    {
        return
        [
            new("Goods/Works/Services", 0m, 50_000_000m, "CGIS Direct Approval", "CGIS_DIRECT_APPROVAL", "CGIS Direct Approval", true, false, false, null, null, "Fallback band when live threshold records are unavailable."),
            new("Goods/Works/Services", 50_000_000m, 100_000_000m, "NIS Tenders Board Review", "NIS_TENDERS_BOARD", "NIS Tenders Board (Chair: CGIS)", false, true, false, null, "NIS Tenders Board", "Board route applies within entity authority under the chairmanship of CGIS."),
            new("Goods/Works/Services", 100_000_000m, null, "NIS Tenders Board + BPP No Objection", "BPP_PRIOR_REVIEW", "NIS Tenders Board + BPP No Objection", false, true, true, null, "NIS Tenders Board", "BPP prior review applies after NIS Tenders Board endorsement chaired by CGIS.")
        ];
    }
}


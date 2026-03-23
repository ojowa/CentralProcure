using eProcurement.Modules.Identity.DTOs;

namespace eProcurement.Modules.Identity.Services;

internal static class InternalModuleCatalog
{
    private static readonly IReadOnlyDictionary<string, string> RoleAliases =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["system_administrator"] = "ict_admin",
            ["tenders_board_member"] = "tenders_board",
            ["audit_officer"] = "audit_oversight",
            ["department_user"] = "requisitioning_officer",
            ["procurement_planning_committee"] = "planning_statistics_officer",
            ["bppliaison"] = "bpp_liaison",
            ["bppreviewer"] = "bpp_reviewer",
            ["requisitioningofficer"] = "requisitioning_officer",
            ["departmenthead"] = "department_head",
            ["procurementmanager"] = "procurement_manager",
            ["planningstatisticsofficer"] = "planning_statistics_officer",
            ["financialunitofficer"] = "financial_unit_officer",
            ["procurementsecretary"] = "procurement_secretary",
            ["comptrollerprocurement"] = "comptroller_procurement",
            ["legalreviewer"] = "legal_reviewer",
            ["legalreviewofficer"] = "legal_reviewer",
            ["technicalevaluator"] = "technical_evaluator",
            ["financialevaluator"] = "financial_evaluator",
            ["evaluationcommittee"] = "evaluation_committee",
            ["tendersboardmember"] = "tenders_board",
            ["tendersboardsecretary"] = "tenders_board_secretary",
            ["accountingofficer"] = "accounting_officer",
            ["complaintsreviewofficer"] = "complaints_review_officer",
            ["contractmanager"] = "contract_manager",
            ["inspectionofficer"] = "inspection_officer",
            ["paymentofficer"] = "payment_officer"
        };

    private static readonly IReadOnlySet<string> WorkflowScopedActions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "procurement_plan.manage",
        "requisition.create",
        "requisition.view",
        "requisition.track",
        "planning_committee.view",
        "approval.review",
        "tender.manage",
        "bid_opening.manage",
        "bid_opening.view_detail",
        "evaluation.actions",
        "evaluation_report.view",
        "approval.decide",
        "high_value_tenders.review",
        "final_approval.decide",
        "bpp.create",
        "bpp.review",
        "contract_award.publish",
        "contract_award.view",
        "contract_management.manage",
        "inspection.view",
        "inspection.update",
        "payment_tracking.view",
        "closeout.create",
        "audit_dashboard.view",
        "audit_trail.view",
        "compliance_reports.view",
        "administrative_review.view",
        "administrative_review.update",
        "administrative_review.resolve"
    };

    private static readonly IReadOnlySet<string> AllInternalRoles = RoleSet(
        "Admin",
        "SystemAdministrator",
        "RequisitioningOfficer",
        "DepartmentHead",
        "ComptrollerProcurement",
        "ProcurementManager",
        "PlanningStatisticsOfficer",
        "FinancialUnitOfficer",
        "ProcurementSecretary",
        "ComptrollerProcurement",
        "LegalReviewer",
        "TechnicalEvaluator",
        "FinancialEvaluator",
        "EvaluationCommittee",
        "TendersBoardMember",
        "TendersBoardSecretary",
        "AccountingOfficer",
        "BPPLiaison",
        "BPPReviewer",
        "ComplaintsReviewOfficer",
        "ContractManager",
        "InspectionOfficer",
        "PaymentOfficer",
        "AuditOfficer");

    private sealed record InternalModuleDefinition(
        string Id,
        string Title,
        string Section,
        string Description,
        string Microservice,
        string ControlPurpose,
        IReadOnlyList<string> Actions,
        IReadOnlySet<string> AllowedRoles);

    private static readonly InternalModuleDefinition[] Modules =
    [
        new("workflow-blueprint", "Procurement Workflow Blueprint", "Governance and Planning", "Review the end-to-end APP, threshold, procurement, and oversight flow.", "Workflow Blueprint Service", "Single source of truth for statutory routing and responsibilities.", ActionSet("workflow_blueprint.view"), AllInternalRoles),
        new("create-requisition", "Create Requisition", "Requisitioning Departments", "Initiate departmental procurement requests with budget and requirement metadata.", "Requisition Service", "Controlled initiation of procurement.", ActionSet("requisition.create"), RoleSet("RequisitioningOfficer", "DepartmentHead")),
        new("requisition-history", "Requisition History", "Requisitioning Departments", "View historical department requests and current workflow states.", "Requisition Service", "Visibility without unauthorized control.", ActionSet("requisition.view"), RoleSet("RequisitioningOfficer", "DepartmentHead")),
        new("requisition-tracking", "Requisition Tracking", "Requisitioning Departments", "Track routing progress across procurement, evaluation, and approvals.", "Audit and Compliance Service", "Read-only timeline for accountable traceability.", ActionSet("requisition.track"), RoleSet("RequisitioningOfficer", "DepartmentHead", "ComplaintsReviewOfficer", "AuditOfficer", "Admin")),
        new("requisition-management", "Requisition Management", "Governance & Oversight", "Administrative control over all departmental procurement requests, including hard deletion and state overrides.", "Requisition Service", "Ultimate administrative control over requisition lifecycle.", ActionSet("requisition.delete", "requisition.view.all", "requisition.update", "requisition.view"), RoleSet("Admin", "ComptrollerProcurement")),
        new("procurement-planning-committee", "Planning Committee Review", "Procurement Planning Committee", "Review APP assumptions across planning, finance, legal, and procurement members.", "Procurement Planning Service", "Section 21 planning committee visibility and pre-tender discipline.", ActionSet("planning_committee.view"), RoleSet("ComptrollerProcurement", "PlanningStatisticsOfficer", "FinancialUnitOfficer", "LegalReviewer", "DepartmentHead", "ProcurementSecretary", "ComptrollerProcurement")),
        new("annual-procurement-plan", "Annual Procurement Plan (APP)", "Procurement Unit", "Create and maintain planning items aligned to statutory thresholds.", "Procurement Planning Service", "Legal planning compliance and budget discipline.", ActionSet("procurement_plan.manage"), RoleSet("ComptrollerProcurement", "ProcurementSecretary", "SystemAdministrator", "Admin")),
        new("create-tender", "Create Tender", "Procurement Unit", "Draft tender packages, methods, and timelines before publication.", "Tender Management Service", "Method and threshold enforcement.", ActionSet("tender.manage"), RoleSet("ComptrollerProcurement", "ProcurementManager")),
        new("publish-tender", "Publish Tender", "Procurement Unit", "Release approved tenders to the public portal at scheduled windows.", "Tender Management Service", "Controlled public disclosure.", ActionSet("tender.manage"), RoleSet("ComptrollerProcurement", "ProcurementManager")),
        new("bid-opening-session", "Bid Opening Session", "Procurement Unit", "Open bids at scheduled deadlines with committee-level controls.", "Bid Opening Service", "Timed and committee-controlled opening.", ActionSet("bid_opening.manage", "bid_opening.view_detail"), RoleSet("ComptrollerProcurement", "ProcurementManager", "SystemAdministrator", "Admin")),
        new("bid-opening-session", "Bid Opening Session", "Procurement Unit", "Open bids at scheduled deadlines with committee-level controls.", "Bid Opening Service", "Timed and committee-controlled opening.", ActionSet("bid_opening.view_detail", "bid_opening.financial_view"), RoleSet("FinancialEvaluator")),
        new("bid-opening-session", "Bid Opening Session", "Procurement Unit", "Open bids at scheduled deadlines with committee-level controls.", "Bid Opening Service", "Timed and committee-controlled opening.", ActionSet("bid_opening.view_detail"), RoleSet("TechnicalEvaluator", "EvaluationCommittee")),
        new("assigned-tenders", "Assigned Tenders", "Evaluation Committees", "List tenders assigned to the current committee for scoring.", "Evaluation Service", "Controlled assignment and access.", ActionSet("evaluation.actions"), RoleSet("TechnicalEvaluator", "FinancialEvaluator", "EvaluationCommittee")),
        new("technical-evaluation", "Technical Evaluation", "Evaluation Committees", "Score technical compliance against objective criteria.", "Evaluation Service", "Objective technical scoring controls.", ActionSet("evaluation.actions"), RoleSet("TechnicalEvaluator", "EvaluationCommittee")),
        new("financial-evaluation", "Financial Evaluation", "Evaluation Committees", "Validate arithmetic accuracy and commercial competitiveness.", "Evaluation Service", "Arithmetic and price validation.", ActionSet("evaluation.actions"), RoleSet("FinancialEvaluator", "FinancialUnitOfficer", "EvaluationCommittee")),
        new("evaluation-report", "Evaluation Report", "Evaluation Committees", "Generate structured recommendations for approval workflows.", "Evaluation Service", "Consolidated evaluation record.", ActionSet("evaluation_report.view"), RoleSet("TechnicalEvaluator", "FinancialEvaluator", "EvaluationCommittee", "TendersBoardMember", "TendersBoardSecretary")),
        new("tender-review", "Tender Review", "NIS Tenders Board and CGIS Approvals", "Review committee outputs, clarifications, and exceptions for the NIS Tenders Board chaired by CGIS.", "Approval Workflow Service", "Threshold-based approval governance.", ActionSet("approval.review"), RoleSet("TendersBoardMember", "TendersBoardSecretary")),
        new("approval-rejection", "Approval or Rejection", "NIS Tenders Board and CGIS Approvals", "Record board outcomes with mandatory rationale under the chairmanship of CGIS.", "Approval Workflow Service", "Non-repudiable approval decisions.", ActionSet("approval.decide"), RoleSet("TendersBoardMember", "TendersBoardSecretary")),
        new("high-value-tenders", "High-Value Tenders", "CGIS", "Review tenders above delegated thresholds.", "Approval Workflow Service", "CGIS authority for high-value spend.", ActionSet("high_value_tenders.review"), RoleSet("AccountingOfficer")),
        new("final-approval", "Final Approval", "CGIS", "Issue final approval for eligible procurements.", "Approval Workflow Service", "Final statutory authority checkpoint.", ActionSet("final_approval.decide"), RoleSet("AccountingOfficer")),
        new("bpp-escalation", "BPP Escalation", "CGIS", "Escalate required cases for no-objection workflows.", "BPP Integration Service", "Regulatory compliance and external traceability.", ActionSet("bpp.create"), RoleSet("AccountingOfficer", "BPPLiaison")),
        new("bpp-escalation", "BPP Escalation", "CGIS", "Escalate required cases for no-objection workflows.", "BPP Integration Service", "Regulatory compliance and external traceability.", ActionSet("bpp.review"), RoleSet("BPPReviewer")),
        new("administrative-review", "Administrative Review", "Administrative Review", "Track complaints, review petitions, and challenge resolution records.", "Audit and Compliance Service", "Section 54 bidder review visibility and accountable resolution.", ActionSet("administrative_review.view", "administrative_review.update", "administrative_review.resolve"), RoleSet("ComplaintsReviewOfficer", "AccountingOfficer", "BPPReviewer", "AuditOfficer")),
        new("contract-award", "Contract Award", "Post-Award Management", "Publish award notices and transition to delivery controls.", "Contract Management Service", "Award legality and contract traceability.", ActionSet("contract_award.publish"), RoleSet("ComptrollerProcurement", "ProcurementManager", "AccountingOfficer")),
        new("contract-award", "Contract Award", "Post-Award Management", "Publish award notices and transition to delivery controls.", "Contract Management Service", "Award legality and contract traceability.", ActionSet("contract_award.view"), RoleSet("ContractManager")),
        new("contract-management", "Contract Management", "Post-Award Management", "Track milestones, variations, and completion status.", "Contract Management Service", "Lifecycle governance and change discipline.", ActionSet("contract_management.manage"), RoleSet("ComptrollerProcurement", "ProcurementManager", "AccountingOfficer", "ContractManager")),
        new("inspection-acceptance", "Inspection and Acceptance", "Post-Award Management", "Record delivery verification before payment release.", "Inspection Service", "Delivery verification and accountability.", ActionSet("inspection.view", "inspection.update"), RoleSet("ComptrollerProcurement", "InspectionOfficer", "AuditOfficer")),
        new("payment-tracking", "Payment Tracking", "Post-Award Management", "Monitor payment milestones against acceptance outcomes.", "Payment Tracking Service", "Financial transparency and spend monitoring.", ActionSet("payment_tracking.view", "closeout.create"), RoleSet("AccountingOfficer", "PaymentOfficer", "AuditOfficer")),
        new("audit-dashboard", "Audit Dashboard", "Audit and Oversight", "Monitor compliance indicators across procurement lifecycle.", "Audit and Compliance Service", "Oversight and investigation visibility.", ActionSet("audit_dashboard.view"), RoleSet("Admin", "ComplaintsReviewOfficer", "AuditOfficer")),
        new("audit-trail-viewer", "Audit Trail Viewer", "Audit and Oversight", "Review immutable event logs and user action trails.", "Audit and Compliance Service", "Immutable evidence for accountability.", ActionSet("audit_trail.view"), RoleSet("Admin", "BPPLiaison", "BPPReviewer", "ComplaintsReviewOfficer", "AuditOfficer")),
        new("compliance-reports", "Compliance Reports", "Audit and Oversight", "Generate compliance packs for management and regulators.", "Audit and Compliance Service", "Formal governance reporting.", ActionSet("compliance_reports.view"), RoleSet("Admin", "BPPLiaison", "BPPReviewer", "ComplaintsReviewOfficer", "AuditOfficer")),
        new("user-role-management", "User and Role Management", "System Administration", "Provision and maintain role-based access permissions.", "Identity and Access Service", "Separation-of-duties enforcement.", ActionSet("admin.manage_roles"), RoleSet("Admin", "SystemAdministrator")),
        new("vendor-registration-approval", "Vendor Registration Approval", "System Administration", "Review vendor onboarding submissions, inspect compliance uploads, and activate approved suppliers.", "Vendor Sourcing Service", "Controlled activation of external supplier accounts.", ActionSet("admin.vendor_approval"), RoleSet("Admin", "SystemAdministrator")),
        new("workflow-configuration", "Workflow Configuration", "System Administration", "Configure policy-controlled workflow routes and gates.", "Workflow Orchestration Service", "Policy enforcement across process states.", ActionSet("admin.manage_workflows"), RoleSet("Admin", "SystemAdministrator")),
        new("system-monitoring", "System Monitoring and Health", "System Administration", "Track service health, integration failures, and alerts.", "Monitoring Service", "Operational oversight and resilience.", ActionSet("admin.monitor"), RoleSet("Admin", "SystemAdministrator"))
    ];

    public static IReadOnlyList<InternalModuleResult> GetModulesForRole(string? role, IReadOnlyList<string>? additionalActions = null)
    {
        var normalizedRole = NormalizeRoleKey(role);
        if (string.IsNullOrWhiteSpace(normalizedRole))
        {
            return [];
        }

        var additionalActionSet = additionalActions is null
            ? null
            : new HashSet<string>(additionalActions, StringComparer.OrdinalIgnoreCase);

        return Modules
            .Where(module => module.AllowedRoles.Any(allowedRole =>
                string.Equals(NormalizeRoleKey(allowedRole), normalizedRole, StringComparison.OrdinalIgnoreCase)))
            .GroupBy(module => module.Id, StringComparer.OrdinalIgnoreCase)
            .Select(group =>
            {
                var first = group.First();
                var catalogActions = group
                    .SelectMany(module => module.Actions)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(action => action, StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                var actions = group
                    .SelectMany(module => module.Actions)
                    .Where(action =>
                        additionalActionSet is null ||
                        additionalActionSet.Count == 0 ||
                        !WorkflowScopedActions.Contains(action) ||
                        additionalActionSet.Contains(action) ||
                        action.StartsWith("admin.", StringComparison.OrdinalIgnoreCase))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(action => action, StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                var allowedRoles = group
                    .SelectMany(module => module.AllowedRoles)
                    .Select(NormalizeRoleKey)
                    .OfType<string>()
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(roleKey => roleKey, StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                return new InternalModuleResult(
                    first.Id,
                    first.Title,
                    first.Section,
                    first.Description,
                    first.Microservice,
                    first.ControlPurpose,
                    actions,
                    catalogActions,
                    allowedRoles);
            })
            .ToArray();
    }

    public static IReadOnlyList<InternalModuleResult> GetAllModules(IReadOnlyList<string>? additionalActions = null)
    {
        var additionalActionSet = additionalActions is null
            ? null
            : new HashSet<string>(additionalActions, StringComparer.OrdinalIgnoreCase);

        return Modules
            .GroupBy(module => module.Id, StringComparer.OrdinalIgnoreCase)
            .Select(group =>
            {
                var first = group.First();
                var catalogActions = group
                    .SelectMany(module => module.Actions)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(action => action, StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                var actions = group
                    .SelectMany(module => module.Actions)
                    .Where(action =>
                        additionalActionSet is null ||
                        additionalActionSet.Count == 0 ||
                        !WorkflowScopedActions.Contains(action) ||
                        additionalActionSet.Contains(action) ||
                        action.StartsWith("admin.", StringComparison.OrdinalIgnoreCase))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(action => action, StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                var allowedRoles = group
                    .SelectMany(module => module.AllowedRoles)
                    .Select(NormalizeRoleKey)
                    .OfType<string>()
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(roleKey => roleKey, StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                return new InternalModuleResult(
                    first.Id,
                    first.Title,
                    first.Section,
                    first.Description,
                    first.Microservice,
                    first.ControlPurpose,
                    actions,
                    catalogActions,
                    allowedRoles);
            })
            .ToArray();
    }

    private static IReadOnlyList<string> ActionSet(params string[] actions) => actions;

    private static IReadOnlySet<string> RoleSet(params string[] roles) =>
        new HashSet<string>(roles, StringComparer.OrdinalIgnoreCase);

    private static string? NormalizeRoleKey(string? role)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            return null;
        }

        var trimmed = role.Trim();
        var withUnderscores = trimmed.Replace("-", "_").Replace(" ", "_");
        var snakeCase = System.Text.RegularExpressions.Regex.Replace(withUnderscores, "([a-z0-9])([A-Z])", "$1_$2");
        var normalized = snakeCase.ToLowerInvariant();

        return RoleAliases.TryGetValue(normalized, out var alias)
            ? alias
            : normalized;
    }
}



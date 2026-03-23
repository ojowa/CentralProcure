namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public record ProcurementPlanSummary(
    Guid PlanId,
    string PlanTitle,
    string Department,
    int FiscalYear,
    string Status,
    decimal TotalBudget,
    DateTime CreatedAt);

public record ProcurementPlanDetail(
    Guid PlanId,
    string PlanTitle,
    string Department,
    int FiscalYear,
    string Status,
    string? CurrentStageKey,
    string? CurrentStageTitle,
    decimal TotalBudget,
    string? Notes,
    DateTime? SubmittedAt,
    DateTime? ApprovedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record ProcurementPlanApprovalDecisionRequest(
    string Decision,
    string? Note);

public record ProcurementPlanApprovalDecisionResponse(
    Guid PlanId,
    string Decision,
    string Message,
    string StageKey,
    string StageTitle,
    string WorkflowStatus,
    string PlanStatus,
    DateTime? ApprovedAt);

public record ProcurementPlanRecommendationResponse(
    Guid PlanId,
    string Message,
    string StageKey,
    string StageTitle,
    string WorkflowStatus,
    string PlanStatus,
    DateTime SubmittedAt);

public record ProcurementPlanRecommendationReadinessResponse(
    Guid PlanId,
    int TotalTrackedRequisitions,
    int RecommendedRequisitions,
    int PendingFinalDecisionRequisitions,
    int NonRecommendedRequisitions,
    int AppItemCount,
    bool CanRecommend,
    string Message,
    IReadOnlyList<ProcurementPlanRecommendationRequisitionResponse> Requisitions);

public record ProcurementPlanRecommendationRequisitionResponse(
    Guid RequisitionId,
    string Title,
    string Department,
    decimal TotalEstimate,
    string? FinalCommitteeDecision,
    Guid? AppItemId,
    bool IsReadyForRecommendation);

public record ProcurementInitiationResponse(
    Guid PlanId,
    string Message,
    string StageKey,
    string StageTitle,
    string WorkflowStatus,
    Guid? ThresholdId,
    string? ApprovalRoute,
    string? ApprovalAuthorityCode,
    string? ApprovalAuthorityLabel,
    bool RequiresCgisApproval,
    bool RequiresBoard,
    bool RequiresBpp,
    Guid? GovernanceBodyId,
    string? GovernanceBodyName,
    decimal? Amount,
    string? ProcurementType,
    string? Notes);

public record ProcurementPlanCreateRequest(
    string PlanTitle,
    string Department,
    int FiscalYear,
    decimal TotalBudget,
    string? Notes,
    string? Status);

public record ProcurementPlanUpdateRequest(
    string? PlanTitle,
    string? Department,
    int? FiscalYear,
    string? Status,
    decimal? TotalBudget,
    string? Notes,
    DateTime? SubmittedAt,
    DateTime? ApprovedAt);

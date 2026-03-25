namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public record ProcurementPlanSummary(
    Guid PlanId,
    string PlanTitle,
    string Department,
    int FiscalYear,
    string Status,
    string? CurrentStageKey,
    string? CurrentStageTitle,
    decimal TotalBudget,
    DateTime CreatedAt,
    Guid? YearlyAppId = null,
    string? YearlyAppTitle = null);

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
    DateTime UpdatedAt,
    Guid? YearlyAppId = null,
    string? YearlyAppTitle = null);

public record YearlyAppSummary(
    Guid YearlyAppId,
    string Title,
    int FiscalYear,
    string Status,
    string? CurrentStageKey,
    string? CurrentStageTitle,
    int PlansCount,
    int IncludedPlansCount,
    int PendingPlansCount,
    int ItemsCount,
    decimal TotalBudget,
    DateTime CreatedAt);

public record YearlyAppDetail(
    Guid YearlyAppId,
    string Title,
    int FiscalYear,
    string Status,
    string? CurrentStageKey,
    string? CurrentStageTitle,
    decimal TotalBudget,
    int PlansCount,
    int IncludedPlansCount,
    int PendingPlansCount,
    int ItemsCount,
    string? Notes,
    DateTime? SubmittedAt,
    DateTime? ApprovedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record YearlyAppPlanSummary(
    Guid PlanId,
    string PlanTitle,
    string Department,
    int FiscalYear,
    string Status,
    string? CurrentStageKey,
    string? CurrentStageTitle,
    decimal TotalBudget,
    int ItemCount,
    DateTime CreatedAt);

public record YearlyAppDetailsResponse(
    YearlyAppDetail App,
    IReadOnlyList<YearlyAppPlanSummary> IncludedPlans,
    IReadOnlyList<YearlyAppPlanSummary> PendingPlans);

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

public record ProcurementPlanRecommendationRequest(
    string? Note);

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

public record YearlyAppRecommendationReadinessResponse(
    Guid YearlyAppId,
    int TotalPlans,
    int TotalTrackedRequisitions,
    int RecommendedRequisitions,
    int PendingFinalDecisionRequisitions,
    int NonRecommendedRequisitions,
    int AppItemCount,
    bool CanRecommend,
    string Message,
    IReadOnlyList<ProcurementPlanRecommendationRequisitionResponse> Requisitions);

public record YearlyAppRecommendationResponse(
    Guid YearlyAppId,
    string Message,
    string StageKey,
    string StageTitle,
    string WorkflowStatus,
    string AppStatus,
    DateTime SubmittedAt);

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

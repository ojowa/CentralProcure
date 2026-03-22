using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.Governance.DTOs;

public record BudgetAvailabilityResponse(decimal Available);

public record BudgetSummaryResponse(
    decimal Appropriated,
    decimal Released,
    decimal Committed,
    decimal Spent,
    decimal Available);

public record BudgetDashboardRiskItem(
    Guid PlanId,
    string PlanTitle,
    string Department,
    string BudgetCode,
    int FiscalYear,
    decimal RequestedAmount,
    decimal Available,
    decimal Variance);

public record BudgetDashboardResponse(
    decimal Appropriated,
    decimal Released,
    decimal Committed,
    decimal Spent,
    decimal Available,
    int QueueCount,
    int AwaitingBudgetReviewCount,
    int OnHoldCount,
    int ReadyForApprovalCount,
    int AtRiskCount,
    IReadOnlyList<BudgetDashboardRiskItem> TopRisks);

public record BudgetConfirmationQueueItem(
    Guid PlanId,
    string PlanTitle,
    string Department,
    int FiscalYear,
    string PlanStatus,
    string CurrentStageKey,
    string CurrentStageTitle,
    string? WorkflowStatus,
    decimal TotalBudget,
    decimal RequestedAmount,
    decimal Appropriated,
    decimal Released,
    decimal Committed,
    decimal Spent,
    decimal Available,
    decimal Variance,
    int ItemCount,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record BudgetConfirmationListResponse(
    IReadOnlyList<BudgetConfirmationQueueItem> Items,
    int Page,
    int PageSize,
    long Total);

public record BudgetPlanItemSummary(
    Guid PlanItemId,
    string? ItemCode,
    string Description,
    string BudgetCode,
    string? ProcurementType,
    decimal EstimatedAmount,
    string Status,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record BudgetPlanBudgetLine(
    string BudgetCode,
    decimal RequestedAmount,
    decimal Appropriated,
    decimal Released,
    decimal Committed,
    decimal Spent,
    decimal Available,
    decimal Variance,
    int ItemCount);

public record BudgetDecisionHistoryEntry(
    Guid HistoryId,
    string? FromStageKey,
    string ToStageKey,
    string ToStageTitle,
    string? StageStatus,
    string TransitionSource,
    string? TransitionReason,
    string? Actor,
    DateTime CreatedAt);

public record BudgetConfirmationDetail(
    Guid PlanId,
    string PlanTitle,
    string Department,
    int FiscalYear,
    string PlanStatus,
    string CurrentStageKey,
    string CurrentStageTitle,
    string? WorkflowStatus,
    string? Notes,
    decimal TotalBudget,
    decimal RequestedAmount,
    decimal Appropriated,
    decimal Released,
    decimal Committed,
    decimal Spent,
    decimal Available,
    decimal Variance,
    int ItemCount,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    WorkflowRuntimeDisplay? WorkflowDisplay,
    IReadOnlyList<BudgetPlanBudgetLine> BudgetLines,
    IReadOnlyList<BudgetPlanItemSummary> PlanItems,
    IReadOnlyList<BudgetDecisionHistoryEntry> History);

public record BudgetDecisionRequest(string Decision, string? Note);

public record BudgetDecisionResponse(
    Guid PlanId,
    string Decision,
    string Message,
    string CurrentStageKey,
    string CurrentStageTitle,
    string? WorkflowStatus,
    string PlanStatus);

public record BudgetAppropriationCreateRequest(
    int FiscalYear,
    string Department,
    string BudgetCode,
    decimal Amount,
    string? Status,
    string? Notes);

public record BudgetAppropriationResponse(
    Guid AppropriationId,
    int FiscalYear,
    string Department,
    string BudgetCode,
    decimal Amount,
    string Status,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record BudgetAppropriationListResponse(
    IReadOnlyList<BudgetAppropriationResponse> Items,
    int Page,
    int PageSize,
    long Total);

public record BudgetReleaseCreateRequest(
    Guid AppropriationId,
    decimal Amount,
    DateTime? ReleaseDate,
    string? Notes);

public record BudgetReleaseResponse(
    Guid ReleaseId,
    Guid AppropriationId,
    int FiscalYear,
    string Department,
    string BudgetCode,
    decimal AppropriationAmount,
    decimal Amount,
    DateTime ReleaseDate,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record BudgetReleaseListResponse(
    IReadOnlyList<BudgetReleaseResponse> Items,
    int Page,
    int PageSize,
    long Total);

public record BudgetCommitmentCreateRequest(
    Guid AppropriationId,
    decimal Amount,
    DateTime? CommittedAt);

public record BudgetCommitmentResponse(
    Guid CommitmentId,
    Guid? AppropriationId,
    Guid? RequisitionId,
    string? RequisitionTitle,
    string? RequisitionStatus,
    int FiscalYear,
    string Department,
    string BudgetCode,
    decimal AppropriationAmount,
    decimal Amount,
    DateTime CommittedAt,
    string Status,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record BudgetCommitmentListResponse(
    IReadOnlyList<BudgetCommitmentResponse> Items,
    int Page,
    int PageSize,
    long Total);

public record BudgetExpenditureCreateRequest(
    Guid CommitmentId,
    decimal Amount,
    DateTime? SpentAt,
    string? Notes);

public record BudgetCommitmentSummary(
    Guid CommitmentId,
    Guid? RequisitionId,
    Guid? TenderId,
    int FiscalYear,
    string Department,
    string BudgetCode,
    decimal Amount,
    string Status,
    DateTime CommittedAt);

public record BudgetRequisitionQueueItem(
    Guid RequisitionId,
    string Title,
    string Department,
    string? BudgetCode,
    Guid? AppItemId,
    decimal TotalEstimate,
    DateTime? RequiredBy,
    string Status,
    string CurrentStageKey,
    string CurrentStageTitle,
    string? WorkflowStatus,
    decimal Available,
    decimal Committed,
    decimal Variance,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record BudgetRequisitionListResponse(
    IReadOnlyList<BudgetRequisitionQueueItem> Items,
    int Page,
    int PageSize,
    long Total);

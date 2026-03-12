namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public record ProcurementPlanItemDetail(
    Guid PlanItemId,
    Guid PlanId,
    string? ItemCode,
    string Description,
    string BudgetCode,
    string? ProcurementType,
    decimal EstimatedAmount,
    string Status,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record ProcurementPlanItemCreateRequest(
    string? ItemCode,
    string Description,
    string BudgetCode,
    string? ProcurementType,
    decimal? EstimatedAmount,
    string? Status,
    string? Notes);

public record ProcurementPlanItemUpdateRequest(
    string? ItemCode,
    string? Description,
    string? BudgetCode,
    string? ProcurementType,
    decimal? EstimatedAmount,
    string? Status,
    string? Notes);

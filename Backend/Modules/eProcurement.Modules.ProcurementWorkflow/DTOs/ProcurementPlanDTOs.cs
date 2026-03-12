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
    decimal TotalBudget,
    string? Notes,
    DateTime? SubmittedAt,
    DateTime? ApprovedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

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

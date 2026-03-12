namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public record RequisitionLineItemDto(
    string? ItemId,
    string Description,
    string Unit,
    decimal Quantity,
    decimal UnitCost);

public record RequisitionSummary(
    Guid RequisitionId,
    string Title,
    string Department,
    string Status,
    string? Priority,
    string? FundingSource,
    decimal TotalEstimate,
    DateTime? RequiredBy,
    DateTime CreatedAt);

public record RequisitionDetail(
    Guid RequisitionId,
    string Title,
    string Department,
    string Status,
    string? Priority,
    string? FundingSource,
    decimal TotalEstimate,
    DateTime? RequiredBy,
    DateTime CreatedAt,
    string? ProcurementType,
    string? BudgetCode,
    Guid? AppItemId,
    string? ProjectCode,
    string? DeliveryLocation,
    string? Justification,
    string? RiskNotes,
    List<RequisitionLineItemDto> LineItems,
    DateTime UpdatedAt,
    string? CurrentStage);

public record RequisitionCreateRequest(
    string Title,
    string Department,
    string? ProcurementType,
    string? Priority,
    string? FundingSource,
    string? BudgetCode,
    Guid? AppItemId,
    string? ProjectCode,
    DateTime? RequiredBy,
    string? DeliveryLocation,
    string? Justification,
    string? RiskNotes,
    string? Status,
    List<RequisitionLineItemDto> LineItems);

public record RequisitionUpdateRequest(
    string? Title,
    string? Department,
    string? ProcurementType,
    string? Priority,
    string? FundingSource,
    string? BudgetCode,
    Guid? AppItemId,
    string? ProjectCode,
    DateTime? RequiredBy,
    string? DeliveryLocation,
    string? Justification,
    string? RiskNotes,
    string? Status,
    List<RequisitionLineItemDto>? LineItems);

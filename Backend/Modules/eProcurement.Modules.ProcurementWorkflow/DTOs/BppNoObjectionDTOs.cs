namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public record BppNoObjectionDetail(
    Guid NoObjectionId,
    Guid? RequisitionId,
    Guid? TenderId,
    decimal Amount,
    string? ProcurementType,
    string Status,
    string? RequestedBy,
    DateTime RequestedAt,
    string? DecisionBy,
    DateTime? DecisionAt,
    string? DecisionNotes,
    string? ReferenceCode,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record BppNoObjectionCreateRequest(
    Guid? RequisitionId,
    Guid? TenderId,
    decimal Amount,
    string? ProcurementType,
    string? Status,
    string? RequestedBy,
    DateTime? RequestedAt,
    string? ReferenceCode);

public record BppNoObjectionUpdateRequest(
    string? Status,
    string? DecisionBy,
    DateTime? DecisionAt,
    string? DecisionNotes,
    string? ReferenceCode);

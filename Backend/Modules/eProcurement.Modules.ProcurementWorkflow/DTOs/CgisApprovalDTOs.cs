namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public sealed record CgisApprovalRequest(
    string EntityType,
    Guid EntityId,
    string Rationale,
    string? Actor
);

public sealed record CgisQueueItemDto(
    Guid InstanceId,
    string EntityType,
    Guid EntityId,
    string? RecordTitle,
    string? Department,
    decimal? Amount,
    string? ApprovalRoute,
    string? ApprovalAuthorityLabel,
    string? Status,
    string? VendorName,
    DateTime CreatedAt,
    int DaysPending);

public sealed record CgisDocumentDto(
    string DocumentType,
    string? FileName,
    string? FileUrl,
    string? Status,
    DateTime? UpdatedAt);

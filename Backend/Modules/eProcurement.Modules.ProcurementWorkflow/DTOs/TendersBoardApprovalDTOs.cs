namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public sealed record TendersBoardQueueItemDto(
    Guid InstanceId,
    Guid TenderId,
    string TenderTitle,
    string? Department,
    decimal? Amount,
    string? ProcurementType,
    string? ApprovalRoute,
    string? ApprovalAuthorityLabel,
    bool RequiresBpp,
    string? Status,
    string? VendorName,
    string? ReportCode,
    string? Recommendation,
    string? ScoreSummary,
    DateTime? ReportSubmittedAt,
    DateTime CreatedAt,
    int DaysPending);

public sealed record TendersBoardDecisionRequest(
    Guid TenderId,
    string Rationale,
    string? Actor
);

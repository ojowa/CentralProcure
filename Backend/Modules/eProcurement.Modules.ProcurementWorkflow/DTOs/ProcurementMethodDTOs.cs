namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public sealed record ProcurementMethodDecisionRequest(
    string EntityType,
    Guid EntityId,
    string SelectedMethod,
    string Rationale);

public sealed record ProcurementMethodChangeExceptionRequest(
    string EntityType,
    Guid EntityId,
    string RequestedMethod,
    string Rationale);

public sealed record ProcurementMethodExceptionDecisionRequest(
    Guid ExceptionId,
    string? Note);

public sealed record ProcurementMethodQueueItemDto(
    string EntityType,
    Guid EntityId,
    string? RecordTitle,
    string CurrentStageKey,
    string CurrentStageTitle,
    decimal? Amount,
    string? ProcurementType,
    string? ApprovalRoute,
    string? ApprovalAuthorityLabel,
    string? SelectedMethod,
    DateTime? LastDeterminedAt,
    string? ActiveExceptionStatus);

public sealed record ProcurementMethodDecisionDto(
    Guid DecisionId,
    string SelectedMethod,
    string DecisionReason,
    string? DeterminedBy,
    DateTime DeterminedAt,
    bool IsExceptionDecision);

public sealed record ProcurementMethodExceptionDto(
    Guid ExceptionId,
    string CurrentMethod,
    string RequestedMethod,
    string RequestReason,
    string? RequestedBy,
    DateTime RequestedAt,
    string Status,
    string? CgisNote,
    string? ReviewedBy,
    DateTime? ReviewedAt);

public sealed record ProcurementMethodDetailDto(
    string EntityType,
    Guid EntityId,
    string? RecordTitle,
    string CurrentStageKey,
    string CurrentStageTitle,
    decimal? Amount,
    string? ProcurementType,
    string? ApprovalRoute,
    string? ApprovalAuthorityLabel,
    bool RequiresCgisApproval,
    bool RequiresBoard,
    bool RequiresBpp,
    ProcurementMethodDecisionDto? CurrentDecision,
    ProcurementMethodExceptionDto? ActiveException,
    IReadOnlyList<ProcurementMethodExceptionDto> RecentExceptions);

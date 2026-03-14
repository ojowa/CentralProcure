namespace eProcurement.Modules.Governance.DTOs;

public record AuditSummaryResponse(
    int ActiveWorkflowItems,
    int AdministrativeReviewsOpen,
    int CloseoutsArchived,
    int RecentTransitions,
    IReadOnlyList<AuditEventItem> RecentEvents);

public record AuditEventItem(
    Guid HistoryId,
    string EntityType,
    Guid EntityId,
    string? FromStageKey,
    string ToStageKey,
    string ToStageTitle,
    string? StageStatus,
    string TransitionSource,
    string? Actor,
    DateTime CreatedAt);

public record AuditCloseoutItem(
    Guid CloseoutId,
    string CloseoutReference,
    string EntityType,
    Guid EntityId,
    string Status,
    string? RecordTitle,
    bool FinalAcceptanceCompleted,
    bool FinalPaymentCompleted,
    string? ArchivedBy,
    DateTime? ArchivedAt,
    DateTime CreatedAt);

public record AuditCloseoutCreateRequest(
    string EntityType,
    Guid EntityId,
    string Summary,
    string? ArchiveLocation,
    bool FinalAcceptanceCompleted,
    bool FinalPaymentCompleted,
    string? ArchivedBy);

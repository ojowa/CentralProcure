using eProcurement.Shared.Workflow;

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
    string Summary,
    string? ArchiveLocation,
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

public record AuditHistoryItem(
    Guid HistoryId,
    string EntityType,
    Guid EntityId,
    string? RecordTitle,
    string? CurrentStageKey,
    string? CurrentStageTitle,
    string? FromStageKey,
    string? FromStageTitle,
    string ToStageKey,
    string ToStageTitle,
    string? StageStatus,
    string TransitionSource,
    string? TransitionReason,
    string? Actor,
    DateTime CreatedAt);

public record AuditHistoryListResponse(
    IReadOnlyList<AuditHistoryItem> Items,
    int Page,
    int PageSize,
    int Total);

public record AuditTransitionDiagnostic(
    string RequestedStageKey,
    string RequestedStageTitle,
    string TransitionCondition,
    bool IsAllowed,
    string? Message);

public record AuditWorkflowDiagnosticsResponse(
    WorkflowRuntimeSnapshot Runtime,
    WorkflowRouteDecision? RouteDecision,
    string? RoleKey,
    IReadOnlyList<WorkflowGrantedAction> GrantedActions,
    IReadOnlyList<WorkflowRuntimeHistoryEntry> RecentHistory,
    IReadOnlyList<AuditTransitionDiagnostic> TransitionChecks);

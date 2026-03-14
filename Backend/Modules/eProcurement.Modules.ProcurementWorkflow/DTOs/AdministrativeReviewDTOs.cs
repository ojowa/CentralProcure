namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public record AdministrativeReviewSummary(
    Guid ComplaintId,
    string ComplaintReference,
    string EntityType,
    Guid EntityId,
    string StageKeyAtFiling,
    string Status,
    string Subject,
    string? FiledBy,
    string? AssignedTo,
    DateTime FiledAt,
    string? ResolutionOutcome,
    DateTime? ResolvedAt);

public record AdministrativeReviewDetail(
    Guid ComplaintId,
    string ComplaintReference,
    string EntityType,
    Guid EntityId,
    string StageKeyAtFiling,
    string Status,
    string Subject,
    string Summary,
    string Details,
    string? ComplaintChannel,
    string? RequestedRemedy,
    string? FiledBy,
    string? AssignedTo,
    string? ReviewedBy,
    string? ResolutionOutcome,
    string? ResolutionStageKey,
    string? ResolutionNotes,
    DateTime FiledAt,
    DateTime? ReviewedAt,
    DateTime? ResolvedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record AdministrativeReviewCreateRequest(
    string EntityType,
    Guid EntityId,
    string Subject,
    string Summary,
    string Details,
    string? ComplaintChannel,
    string? RequestedRemedy,
    string? FiledBy,
    string? AssignedTo);

public record AdministrativeReviewUpdateRequest(
    string? Status,
    string? AssignedTo,
    string? ReviewedBy,
    string? ResolutionOutcome,
    string? ResolutionStageKey,
    string? ResolutionNotes);

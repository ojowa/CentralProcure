namespace eProcurement.Modules.VendorSourcing.DTOs;

public record BidOpeningSessionSummary(
    Guid SessionId,
    Guid TenderId,
    string SessionTitle,
    string? Location,
    DateTime ScheduledAt,
    string Status,
    DateTime? OpenedAt,
    DateTime? ClosedAt,
    DateTime CreatedAt);

public record BidOpeningSessionDetail(
    Guid SessionId,
    Guid TenderId,
    string SessionTitle,
    string? Location,
    DateTime ScheduledAt,
    string Status,
    DateTime? OpenedAt,
    DateTime? ClosedAt,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record BidOpeningSessionListResponse(
    IReadOnlyList<BidOpeningSessionSummary> Items,
    int Page,
    int PageSize,
    long Total);

public record BidOpeningSessionCreateRequest(
    Guid TenderId,
    string SessionTitle,
    string? Location,
    DateTime ScheduledAt,
    string? Status,
    DateTime? OpenedAt,
    DateTime? ClosedAt,
    string? Notes);

public record BidOpeningSessionUpdateRequest(
    string? SessionTitle,
    string? Location,
    DateTime? ScheduledAt,
    string? Status,
    DateTime? OpenedAt,
    DateTime? ClosedAt,
    string? Notes);

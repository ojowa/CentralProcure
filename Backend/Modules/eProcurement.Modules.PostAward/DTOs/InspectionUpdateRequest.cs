namespace eProcurement.Modules.PostAward.DTOs;

public record InspectionUpdateRequest(
    string? Status,
    string? Outcome,
    DateTime? CompletedDate,
    string? Notes,
    string? InspectorName,
    string? Location);

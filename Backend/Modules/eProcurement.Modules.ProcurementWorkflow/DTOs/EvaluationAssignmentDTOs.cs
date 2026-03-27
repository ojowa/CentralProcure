namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public record TenderEvaluationAssignmentItem(
    Guid TenderId,
    string TenderTitle,
    string TenderStatus,
    string AssignmentRole,
    Guid? InternalUserId,
    string? Email,
    string? Username,
    string? RoleName,
    string? UnitName,
    string? AssignedBy,
    DateTime? AssignedAt
);

public record TenderEvaluationAssignmentUpdateRequest(
    string AssignmentRole,
    Guid? InternalUserId
);

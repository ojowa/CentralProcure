namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public record NeedAssessmentSummary(
    Guid NeedAssessmentId,
    Guid UnitId,
    string UnitName,
    string Title,
    int FiscalYear,
    decimal TotalEstimatedCost,
    string Status,
    DateTime CreatedAt,
    string CreatedBy
);

public record NeedAssessmentItemDetail(
    Guid? ItemId,
    string Description,
    decimal Quantity,
    string Unit,
    decimal EstimatedUnitCost,
    decimal EstimatedTotalCost,
    string Priority,
    string ProcurementType
);

public record NeedAssessmentDetail(
    Guid NeedAssessmentId,
    Guid UnitId,
    string UnitName,
    string Title,
    int FiscalYear,
    decimal TotalEstimatedCost,
    string Status,
    string? Remarks,
    DateTime? SubmittedAt,
    DateTime? EndorsedAt,
    string? EndorsedBy,
    List<NeedAssessmentItemDetail> Items,
    DateTime CreatedAt,
    string CreatedBy,
    DateTime UpdatedAt
);

public record NeedAssessmentCreateRequest(
    string Title,
    int FiscalYear,
    string? Remarks,
    List<NeedAssessmentItemDetail> Items
);

public record NeedAssessmentUpdateRequest(
    string? Title,
    int? FiscalYear,
    string? Remarks,
    string? Status,
    List<NeedAssessmentItemDetail>? Items
);

public record NeedAssessmentDecisionRequest(
    string Decision, -- Submit, Endorse, Return, Reject
    string? Remarks
);

public record NeedAssessmentAuthorizedUser(
    Guid InternalUserId,
    string Email,
    string FullName,
    string RoleName,
    string UnitName,
    string AccessType -- Role-Based or Direct Grant
);

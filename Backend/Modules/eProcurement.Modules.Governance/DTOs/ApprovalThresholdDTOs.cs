namespace eProcurement.Modules.Governance.DTOs;

public record ApprovalThresholdDetail(
    Guid ThresholdId,
    string? ProcurementType,
    decimal MinAmount,
    decimal? MaxAmount,
    string ApprovalRoute,
    string ApprovalAuthorityCode,
    string ApprovalAuthorityLabel,
    bool RequiresCgisApproval,
    bool RequiresBoard,
    bool RequiresBpp,
    Guid? GovernanceBodyId,
    string? GovernanceBodyName,
    string Status,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record ApprovalThresholdCreateRequest(
    string? ProcurementType,
    decimal MinAmount,
    decimal? MaxAmount,
    string ApprovalRoute,
    string ApprovalAuthorityCode,
    string ApprovalAuthorityLabel,
    bool RequiresCgisApproval,
    bool RequiresBoard,
    bool RequiresBpp,
    Guid? GovernanceBodyId,
    string? Status,
    string? Notes);

public record ApprovalThresholdUpdateRequest(
    string? ProcurementType,
    decimal? MinAmount,
    decimal? MaxAmount,
    string? ApprovalRoute,
    string? ApprovalAuthorityCode,
    string? ApprovalAuthorityLabel,
    bool? RequiresCgisApproval,
    bool? RequiresBoard,
    bool? RequiresBpp,
    Guid? GovernanceBodyId,
    string? Status,
    string? Notes);

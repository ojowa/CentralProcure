namespace eProcurement.Modules.PostAward.DTOs;

public record ContractMilestoneItem(
    Guid MilestoneId,
    string ContractId,
    string MilestoneTitle,
    string Status,
    int Progress,
    string Notes,
    string ContractManager,
    string RecordedBy,
    DateTime RecordedAt);

public record ContractMilestoneCreateRequest(
    string MilestoneTitle,
    string Status,
    int Progress,
    string Notes,
    string? ContractManager,
    string? RecordedBy);

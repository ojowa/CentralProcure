namespace eProcurement.Modules.PostAward.DTOs;

public record ContractAwardItem(
    Guid AwardEntityId,
    string AwardId,
    string TenderTitle,
    string VendorName,
    decimal AwardValue,
    string Status,
    DateTime AwardDate,
    DateTime ContractStart,
    DateTime ContractEnd,
    string FundingSource,
    string Notes
);

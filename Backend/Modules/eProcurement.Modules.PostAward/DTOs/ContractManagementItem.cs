namespace eProcurement.Modules.PostAward.DTOs;

public record ContractManagementItem(
    string ContractId,
    string TenderTitle,
    string VendorName,
    decimal ContractValue,
    string Status,
    DateTime StartDate,
    DateTime EndDate,
    int Progress,
    string ContractManager,
    string Notes
);

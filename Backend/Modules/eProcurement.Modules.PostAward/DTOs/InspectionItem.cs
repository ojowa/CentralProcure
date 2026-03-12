namespace eProcurement.Modules.PostAward.DTOs;

public record InspectionItem(
    string InspectionId,
    string ContractCode,
    string TenderTitle,
    string VendorName,
    string Status,
    DateTime ScheduledDate,
    DateTime? CompletedDate,
    string InspectorName,
    string? Outcome,
    string Location,
    string? Notes
);

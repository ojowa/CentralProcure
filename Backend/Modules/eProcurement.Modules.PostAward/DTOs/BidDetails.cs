namespace eProcurement.Modules.PostAward.DTOs;

public record BidDetails(
    Guid BidId,
    Guid TenderId,
    string TenderTitle,
    Guid VendorId,
    decimal FinancialBid,
    string TechnicalProposal,
    int ValidityPeriodDays,
    DateTime SubmissionDate,
    string BidStatus);

namespace eProcurement.Modules.PostAward.DTOs;

public record SubmittedBid(
    Guid BidId,
    Guid TenderId,
    Guid VendorId,
    decimal FinancialBid,
    string TechnicalProposal,
    int ValidityPeriodDays,
    DateTime SubmissionDate,
    string BidStatus);

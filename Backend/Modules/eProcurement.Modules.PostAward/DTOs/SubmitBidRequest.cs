namespace eProcurement.Modules.PostAward.DTOs;

public record SubmitBidRequest(
    Guid TenderId,
    Guid VendorId,
    decimal FinancialBid,
    string TechnicalProposal,
    int ValidityPeriodDays);

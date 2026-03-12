using Microsoft.AspNetCore.Http;

namespace eProcurement.Modules.PostAward.DTOs;

public sealed class SubmitBidForm
{
    public Guid TenderId { get; set; }
    public Guid VendorId { get; set; }
    public decimal FinancialBid { get; set; }
    public string? TechnicalProposal { get; set; }
    public int ValidityPeriodDays { get; set; }
    public IFormFile? TechnicalProposalFile { get; set; }
}

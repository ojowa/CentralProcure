using eProcurement.Modules.VendorSourcing.DTOs;

namespace eProcurement.Modules.VendorSourcing.Services;

public interface IVendorAdministrationService
{
    Task<List<VendorApprovalSummary>> GetRegistrationsAsync(string? status, string? query, CancellationToken ct);
    Task<VendorApprovalDetail?> GetRegistrationAsync(Guid vendorId, CancellationToken ct);
    Task<VendorApprovalSummary?> DecideRegistrationAsync(Guid vendorId, VendorApprovalDecisionRequest request, string actor, CancellationToken ct);
    Task<string?> GetComplianceDocumentUrlAsync(Guid documentId, CancellationToken ct);
}

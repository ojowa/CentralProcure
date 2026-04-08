using Microsoft.AspNetCore.Http;
using eProcurement.Modules.VendorSourcing.DTOs;

namespace eProcurement.Modules.VendorSourcing.Services;

public interface IVendorComplianceService
{
    IReadOnlyList<ComplianceRequirement> GetRequirements();
    Task<List<ComplianceDocumentResponse>> GetDocumentsAsync(Guid vendorId, CancellationToken ct);
    Task<ComplianceDocumentResponse> UploadDocumentAsync(Guid vendorId, string documentType, DateTime? expiryDate, IFormFile file, CancellationToken ct);
    Task<string?> GetDocumentUrlAsync(Guid vendorId, Guid documentId, CancellationToken ct);
    Task<List<ComplianceHistoryItem>> GetHistoryAsync(Guid vendorId, string documentType, CancellationToken ct);
    Task<string?> GetHistoryFileUrlAsync(Guid vendorId, Guid historyId, CancellationToken ct);
}

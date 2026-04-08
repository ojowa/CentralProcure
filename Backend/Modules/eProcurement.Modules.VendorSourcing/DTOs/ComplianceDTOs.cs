using Microsoft.AspNetCore.Http;

namespace eProcurement.Modules.VendorSourcing.DTOs;

public sealed record ComplianceUploadForm(
    string DocumentType,
    DateTime? ExpiryDate,
    IFormFile File);

public sealed record ComplianceRequirement(
    string Id,
    string Name,
    bool Required,
    string Frequency,
    bool Expirable,
    string Description);

public sealed record ComplianceDocumentResponse(
    Guid DocumentId,
    string DocumentType,
    string Status,
    DateTime? ExpiryDate,
    DateTime? CreatedAt,
    string FileUrl,
    string? RejectionReason);

public sealed record ComplianceHistoryItem(
    Guid HistoryId,
    Guid DocumentId,
    string DocumentType,
    string DocumentUrl,
    DateTime? ExpiryDate,
    string Status,
    DateTime CreatedAt,
    string FileUrl);

namespace eProcurement.Modules.VendorSourcing.DTOs
{
    public record RegisterVendorRequest(
        string CompanyName,
        string RegistrationNumber,
        string TaxId,
        string CompanyAddress,
        string ContactPerson,
        string Email,
        string Password);

    public record VendorRegistrationResult(Guid VendorId, string CompanyName, string Email);

    public record VendorLoginRequest(string Email, string Password);

    public record VendorLoginResult(
        Guid? VendorId,
        string? CompanyName,
        string? Email,
        string? VendorStatus,
        string? ErrorMessage);

    public record VendorProfile(
        Guid VendorId,
        string CompanyName,
        string RegistrationNumber,
        string TaxId,
        string CompanyAddress,
        string ContactPerson,
        string Email,
        DateTime? RegistrationDate,
        DateTime? LastLogin,
        string VendorStatus);

    public record UpdateVendorProfileRequest(
        string? CompanyName,
        string? CompanyAddress,
        string? ContactPerson,
        string? Email);

    public record UploadComplianceDocumentRequest(
        string DocumentName,
        string DocumentType,
        string FileReference,
        DateTime? ExpiryDate);

    public record ComplianceDocument(
        Guid DocumentId,
        Guid VendorId,
        string DocumentName,
        string DocumentType,
        string FileReference,
        DateTime UploadDate,
        DateTime? ExpiryDate,
        string DocumentStatus,
        string? RejectionReason);

    public record ComplianceDocumentSummary(
        Guid DocumentId,
        Guid VendorId,
        string DocumentName,
        string DocumentType,
        string FileReference,
        string DocumentStatus);
}

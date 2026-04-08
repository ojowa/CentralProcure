using eProcurement.Modules.VendorSourcing.DTOs;

namespace eProcurement.Modules.VendorSourcing.Services;

public interface IVendorService
{
    Task<VendorRegistrationResult> RegisterAsync(RegisterVendorRequest request, CancellationToken ct);
    Task<VendorLoginResult> LoginAsync(VendorLoginRequest request, CancellationToken ct);
    Task<VendorProfile?> GetProfileAsync(Guid vendorId, CancellationToken ct);
    Task<VendorProfile> UpdateProfileAsync(Guid vendorId, UpdateVendorProfileRequest request, CancellationToken ct);
    Task<(bool EmailAvailable, bool RegistrationAvailable, bool TaxAvailable)> CheckAvailabilityAsync(string? email, string? registrationNumber, string? taxId, CancellationToken ct);
}

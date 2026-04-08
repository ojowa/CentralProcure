using System.Security.Claims;
using eProcurement.Modules.PostAward.DTOs;

namespace eProcurement.Modules.PostAward.Services;

public interface IInspectionService
{
    Task<List<InspectionItem>> GetInspectionsAsync(string? status, string? query, CancellationToken ct);
    Task<InspectionItem?> GetInspectionAsync(string inspectionId, CancellationToken ct);
    Task<InspectionItem> UpdateInspectionAsync(string inspectionId, InspectionUpdateRequest request, ClaimsPrincipal user, CancellationToken ct);
}

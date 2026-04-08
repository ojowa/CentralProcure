using System.Security.Claims;
using eProcurement.Modules.ProcurementWorkflow.DTOs;

namespace eProcurement.Modules.ProcurementWorkflow.Services;

public interface IBppNoObjectionService
{
    Task<List<BppNoObjectionDetail>> GetNoObjectionsAsync(Guid? requisitionId, Guid? tenderId, string? status, CancellationToken ct);
    Task<BppNoObjectionDetail?> GetNoObjectionAsync(Guid noObjectionId, CancellationToken ct);
    Task<BppNoObjectionDetail> CreateNoObjectionAsync(BppNoObjectionCreateRequest request, ClaimsPrincipal user, CancellationToken ct);
    Task<BppNoObjectionDetail> UpdateNoObjectionAsync(Guid noObjectionId, BppNoObjectionUpdateRequest request, ClaimsPrincipal user, CancellationToken ct);
}

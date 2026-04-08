using System.Security.Claims;
using eProcurement.Modules.ProcurementWorkflow.DTOs;

namespace eProcurement.Modules.ProcurementWorkflow.Services;

public interface IEvaluationService
{
    Task<List<AssignedTenderItem>> GetAssignedTendersAsync(string? roleKey, Guid? internalUserId, CancellationToken ct);
    Task<Guid?> LogEvaluationActionAsync(EvaluationActionRequest request, ClaimsPrincipal user, CancellationToken ct);
}

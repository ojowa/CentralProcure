using System.Security.Claims;
using eProcurement.Modules.PostAward.DTOs;

namespace eProcurement.Modules.PostAward.Services;

public interface IContractService
{
    Task<List<ContractManagementItem>> GetContractsAsync(string? status, string? query, CancellationToken ct);
    Task<ContractManagementItem?> GetContractAsync(string contractId, CancellationToken ct);
    Task<List<ContractMilestoneItem>> GetContractMilestonesAsync(string contractId, CancellationToken ct);
    Task<ContractManagementItem> LogContractMilestoneAsync(string contractId, ContractMilestoneCreateRequest request, ClaimsPrincipal user, CancellationToken ct);
    Task<List<ContractAwardItem>> GetAwardsAsync(string? status, string? query, CancellationToken ct);
    Task<ContractAwardItem?> GetAwardAsync(string awardId, CancellationToken ct);
    Task<ContractAwardItem> PublishAwardAsync(string awardId, ClaimsPrincipal user, CancellationToken ct);
}

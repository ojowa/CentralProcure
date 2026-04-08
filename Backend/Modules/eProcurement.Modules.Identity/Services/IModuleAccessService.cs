using eProcurement.Modules.Identity.DTOs;

namespace eProcurement.Modules.Identity.Services;

public interface IModuleAccessService
{
    IReadOnlyList<InternalModuleResult> GetModuleCatalog();
    Task<List<RoleModuleAccessGrantResult>> GetRoleModuleAccessAsync(CancellationToken ct);
    Task<List<UserModuleAccessGrantResult>> GetUserModuleAccessAsync(CancellationToken ct);
    Task<List<ModuleAccessAuditResult>> GetModuleAccessAuditAsync(string? roleName, Guid? internalUserId, int limit, CancellationToken ct);
    Task<RoleModuleAccessGrantResult?> UpdateRoleModuleAccessAsync(UpdateRoleModuleAccessRequest request, Guid adminUserId, CancellationToken ct);
    Task<UserModuleAccessGrantResult?> UpdateUserModuleAccessAsync(UpdateUserModuleAccessRequest request, Guid adminUserId, CancellationToken ct);
    Task DeleteRoleModuleAccessAsync(string roleName, string moduleId, Guid adminUserId, CancellationToken ct);
    Task DeleteUserModuleAccessAsync(Guid internalUserId, string moduleId, Guid adminUserId, CancellationToken ct);
    Task<List<InternalOrganizationalUnitResult>> GetInternalUnitsAsync(CancellationToken ct);
    Task DeleteRoleModuleAccessBulkAsync(string roleName, Guid adminUserId, CancellationToken ct);
    Task BulkUpdateUserModuleAccessAsync(BulkUserModuleAccessRequest request, Guid adminUserId, CancellationToken ct);
    Task DeleteUserModuleAccessBulkAsync(Guid internalUserId, Guid adminUserId, CancellationToken ct);
}

using eProcurement.Modules.Identity.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eProcurement.Modules.Identity.Controllers;

public partial class AuthController
{
    [Authorize]
    [HttpGet("internal/units")]
    public async Task<IActionResult> GetInternalUnits(CancellationToken ct)
    {
        try
        {
            return Ok(await _moduleAccessService.GetInternalUnitsAsync(ct));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching organizational units.");
            return Problem("Internal server error.");
        }
    }

    [Authorize]
    [HttpDelete("internal/module-access/roles/bulk")]
    public async Task<IActionResult> DeleteRoleModuleAccessBulk([FromQuery] string roleName, CancellationToken ct)
    {
        if (!IsIdentityAdministrator()) return Forbid();
        if (string.IsNullOrWhiteSpace(roleName)) return BadRequest(new { message = "roleName is required." });
        if (!TryGetAuthenticatedInternalUserId(out var adminUserId, out var authError)) return authError!;

        try
        {
            await _moduleAccessService.DeleteRoleModuleAccessBulkAsync(roleName, adminUserId, ct);
            return Ok(new { message = "Role module access reset." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error deleting role module access for {RoleName}.", roleName);
            return Problem("Internal server error.");
        }
    }

    [Authorize]
    [HttpPut("internal/module-access/users/bulk")]
    public async Task<IActionResult> BulkUpdateUserModuleAccess([FromBody] BulkUserModuleAccessRequest request, CancellationToken ct)
    {
        if (!IsIdentityAdministrator()) return Forbid();
        if (request.InternalUserId == Guid.Empty || request.Grants is null || request.Grants.Count == 0)
            return BadRequest(new { message = "InternalUserId and grants are required." });

        if (!TryGetAuthenticatedInternalUserId(out var adminUserId, out var authError)) return authError!;

        try
        {
            await _moduleAccessService.BulkUpdateUserModuleAccessAsync(request, adminUserId, ct);
            return Ok(new { message = "User module access updated." });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error bulk updating user module access for {UserId}.", request.InternalUserId);
            return Problem("Internal server error.");
        }
    }

    [Authorize]
    [HttpDelete("internal/module-access/users/bulk")]
    public async Task<IActionResult> DeleteUserModuleAccessBulk([FromQuery] Guid internalUserId, CancellationToken ct)
    {
        if (!IsIdentityAdministrator()) return Forbid();
        if (internalUserId == Guid.Empty) return BadRequest(new { message = "internalUserId is required." });
        if (!TryGetAuthenticatedInternalUserId(out var adminUserId, out var authError)) return authError!;

        try
        {
            await _moduleAccessService.DeleteUserModuleAccessBulkAsync(internalUserId, adminUserId, ct);
            return Ok(new { message = "User module access reset." });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error deleting user module access for {UserId}.", internalUserId);
            return Problem("Internal server error.");
        }
    }
}

using eProcurement.Modules.Identity.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eProcurement.Modules.Identity.Controllers;

public partial class AuthController
{
    [Authorize]
    [HttpGet("internal/modules/catalog")]
    public async Task<IActionResult> GetInternalModuleCatalog(CancellationToken ct)
    {
        if (!IsIdentityAdministrator()) return Forbid();
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString)) return Problem("Database connection is not available.");
        return Ok(await _moduleAccessService.GetModuleCatalogAsync(connectionString, ct));
    }

    [Authorize]
    [HttpGet("internal/module-access/roles")]
    public async Task<IActionResult> GetRoleModuleAccess(CancellationToken ct)
    {
        if (!IsIdentityAdministrator()) return Forbid();
        try
        {
            var results = await _moduleAccessService.GetRoleModuleAccessAsync(ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching role module access grants.");
            return Problem("Internal server error.");
        }
    }

    [Authorize]
    [HttpGet("internal/module-access/users")]
    public async Task<IActionResult> GetUserModuleAccess(CancellationToken ct)
    {
        if (!IsIdentityAdministrator()) return Forbid();
        try
        {
            var results = await _moduleAccessService.GetUserModuleAccessAsync(ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching user module access grants.");
            return Problem("Internal server error.");
        }
    }

    [Authorize]
    [HttpGet("internal/module-access/audit")]
    public async Task<IActionResult> GetModuleAccessAudit(
        [FromQuery] string? roleName,
        [FromQuery] Guid? internalUserId,
        [FromQuery] int limit = 100,
        CancellationToken ct = default)
    {
        if (!IsIdentityAdministrator()) return Forbid();
        try
        {
            var results = await _moduleAccessService.GetModuleAccessAuditAsync(roleName, internalUserId, limit, ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching module access audit.");
            return Problem("Internal server error.");
        }
    }

    [Authorize]
    [HttpPut("internal/module-access/roles")]
    public async Task<IActionResult> UpdateRoleModuleAccess([FromBody] UpdateRoleModuleAccessRequest request, CancellationToken ct)
    {
        if (!IsIdentityAdministrator()) return Forbid();
        if (string.IsNullOrWhiteSpace(request.RoleName) || string.IsNullOrWhiteSpace(request.ModuleId))
            return BadRequest(new { message = "RoleName and ModuleId are required." });

        if (!TryGetAuthenticatedInternalUserId(out var adminUserId, out var authError)) return authError!;

        try
        {
            var result = await _moduleAccessService.UpdateRoleModuleAccessAsync(request, adminUserId, ct);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error updating role module access.");
            return Problem("Update failed.");
        }
    }

    [Authorize]
    [HttpPut("internal/module-access/users")]
    public async Task<IActionResult> UpdateUserModuleAccess([FromBody] UpdateUserModuleAccessRequest request, CancellationToken ct)
    {
        if (!IsIdentityAdministrator()) return Forbid();
        if (request.InternalUserId == Guid.Empty || string.IsNullOrWhiteSpace(request.ModuleId))
            return BadRequest(new { message = "InternalUserId and ModuleId are required." });

        if (!TryGetAuthenticatedInternalUserId(out var adminUserId, out var authError)) return authError!;

        try
        {
            var result = await _moduleAccessService.UpdateUserModuleAccessAsync(request, adminUserId, ct);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error updating user module access.");
            return Problem("Update failed.");
        }
    }

    [Authorize]
    [HttpDelete("internal/module-access/roles")]
    public async Task<IActionResult> DeleteRoleModuleAccess(
        [FromQuery] string roleName,
        [FromQuery] string moduleId,
        CancellationToken ct)
    {
        if (!IsIdentityAdministrator()) return Forbid();
        if (string.IsNullOrWhiteSpace(roleName) || string.IsNullOrWhiteSpace(moduleId))
            return BadRequest(new { message = "roleName and moduleId are required." });

        if (!TryGetAuthenticatedInternalUserId(out var adminUserId, out var authError)) return authError!;

        try
        {
            await _moduleAccessService.DeleteRoleModuleAccessAsync(roleName, moduleId, adminUserId, ct);
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error resetting role module access.");
            return Problem("Reset failed.");
        }
    }

    [Authorize]
    [HttpDelete("internal/module-access/users")]
    public async Task<IActionResult> DeleteUserModuleAccess(
        [FromQuery] Guid internalUserId,
        [FromQuery] string moduleId,
        CancellationToken ct)
    {
        if (!IsIdentityAdministrator()) return Forbid();
        if (internalUserId == Guid.Empty || string.IsNullOrWhiteSpace(moduleId))
            return BadRequest(new { message = "internalUserId and moduleId are required." });

        if (!TryGetAuthenticatedInternalUserId(out var adminUserId, out var authError)) return authError!;

        try
        {
            await _moduleAccessService.DeleteUserModuleAccessAsync(internalUserId, moduleId, adminUserId, ct);
            return NoContent();
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error resetting user module access.");
            return Problem("Reset failed.");
        }
    }
}

using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Identity.Controllers;

public partial class AuthController
{
    [Authorize]
    [HttpGet("internal/permissions")]
    public async Task<IActionResult> GetInternalPermissions(CancellationToken ct)
    {
        var role = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
        if (string.IsNullOrWhiteSpace(role))
        {
            return Unauthorized(new { message = "Authenticated role is missing." });
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(
                "SELECT permission_key, module, action, description FROM identity.get_role_permissions(@p_role_name) ORDER BY module, action",
                conn);
            cmd.Parameters.AddWithValue("p_role_name", NpgsqlDbType.Varchar, role);

            var permissions = new List<object>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                permissions.Add(new
                {
                    PermissionKey = reader.GetString(0),
                    Module = reader.GetString(1),
                    Action = reader.GetString(2),
                    Description = reader.IsDBNull(3) ? null : reader.GetString(3)
                });
            }

            return Ok(permissions);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching permissions for role {Role}.", role);
            return Problem("Internal server error fetching permissions.");
        }
    }

    [Authorize]
    [HttpGet("internal/permissions/check")]
    public async Task<IActionResult> CheckPermission([FromQuery] string permissionKey, CancellationToken ct)
    {
        var role = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
        if (string.IsNullOrWhiteSpace(role))
        {
            return Unauthorized(new { message = "Authenticated role is missing." });
        }

        if (string.IsNullOrWhiteSpace(permissionKey))
        {
            return BadRequest(new { message = "permissionKey is required." });
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(
                "SELECT identity.role_has_permission(@p_role_name, @p_permission_key)",
                conn);
            cmd.Parameters.AddWithValue("p_role_name", NpgsqlDbType.Varchar, role);
            cmd.Parameters.AddWithValue("p_permission_key", NpgsqlDbType.Varchar, permissionKey.Trim());

            var result = await cmd.ExecuteScalarAsync(ct);
            var hasPermission = result is true;

            return Ok(new { permissionKey = permissionKey.Trim(), hasPermission });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error checking permission {PermissionKey} for role {Role}.", permissionKey, role);
            return Problem("Internal server error checking permission.");
        }
    }

    [Authorize]
    [HttpGet("internal/permissions/all")]
    public async Task<IActionResult> GetAllPermissions(CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(
                "SELECT permission_key, module, action, description, is_active FROM identity.permissions ORDER BY module, action",
                conn);

            var permissions = new List<object>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                permissions.Add(new
                {
                    PermissionKey = reader.GetString(0),
                    Module = reader.GetString(1),
                    Action = reader.GetString(2),
                    Description = reader.IsDBNull(3) ? null : reader.GetString(3),
                    IsActive = reader.GetBoolean(4)
                });
            }

            return Ok(permissions);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching all permissions.");
            return Problem("Internal server error fetching all permissions.");
        }
    }

    [Authorize]
    [HttpGet("internal/role-permissions")]
    public async Task<IActionResult> GetRolePermissions([FromQuery] string? roleName, CancellationToken ct)
    {
        if (!IsIdentityAdministrator() && string.IsNullOrWhiteSpace(roleName))
        {
            return Forbid();
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            string query;
            var parameters = new List<NpgsqlParameter>();

            if (!string.IsNullOrWhiteSpace(roleName))
            {
                query = "SELECT role_name, permission_key, module, action, description, is_enabled FROM identity.v_role_permissions WHERE role_name = @p_role_name ORDER BY module, action";
                parameters.Add(new NpgsqlParameter("p_role_name", NpgsqlDbType.Varchar) { Value = roleName });
            }
            else
            {
                query = "SELECT role_name, permission_key, module, action, description, is_enabled FROM identity.v_role_permissions ORDER BY role_name, module, action";
            }

            await using var cmd = new NpgsqlCommand(query, conn);
            foreach (var p in parameters) cmd.Parameters.Add(p);

            var result = new List<object>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                result.Add(new
                {
                    RoleName = reader.GetString(0),
                    PermissionKey = reader.GetString(1),
                    Module = reader.GetString(2),
                    Action = reader.GetString(3),
                    Description = reader.IsDBNull(4) ? null : reader.GetString(4),
                    IsEnabled = reader.GetBoolean(5)
                });
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching role permissions.");
            return Problem("Internal server error fetching role permissions.");
        }
    }

    [Authorize]
    [HttpPut("internal/role-permissions")]
    public async Task<IActionResult> UpsertRolePermission([FromBody] UpsertRolePermissionRequest request, CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.RoleName) || string.IsNullOrWhiteSpace(request.PermissionKey))
        {
            return BadRequest(new { message = "RoleName and PermissionKey are required." });
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
                SELECT r.role_id, p.permission_id, @p_is_enabled
                FROM identity.roles r, identity.permissions p
                WHERE r.role_name = @p_role_name AND p.permission_key = @p_permission_key
                ON CONFLICT (role_id, permission_id) DO UPDATE SET is_enabled = @p_is_enabled",
                conn);
            cmd.Parameters.AddWithValue("p_role_name", NpgsqlDbType.Varchar, request.RoleName);
            cmd.Parameters.AddWithValue("p_permission_key", NpgsqlDbType.Varchar, request.PermissionKey);
            cmd.Parameters.AddWithValue("p_is_enabled", NpgsqlDbType.Boolean, request.IsEnabled);

            var affected = await cmd.ExecuteNonQueryAsync(ct);
            return affected > 0 ? Ok(new { message = "Permission updated." }) : NotFound(new { message = "Role or permission not found." });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error upserting role permission for {Role}/{Permission}.", request.RoleName, request.PermissionKey);
            return Problem("Internal server error updating role permission.");
        }
    }

    [Authorize]
    [HttpDelete("internal/role-permissions")]
    public async Task<IActionResult> DeleteRolePermission([FromBody] DeleteRolePermissionRequest request, CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.RoleName) || string.IsNullOrWhiteSpace(request.PermissionKey))
        {
            return BadRequest(new { message = "RoleName and PermissionKey are required." });
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(@"
                DELETE FROM identity.role_permissions
                WHERE role_id = (SELECT role_id FROM identity.roles WHERE role_name = @p_role_name)
                  AND permission_id = (SELECT permission_id FROM identity.permissions WHERE permission_key = @p_permission_key)",
                conn);
            cmd.Parameters.AddWithValue("p_role_name", NpgsqlDbType.Varchar, request.RoleName);
            cmd.Parameters.AddWithValue("p_permission_key", NpgsqlDbType.Varchar, request.PermissionKey);

            var affected = await cmd.ExecuteNonQueryAsync(ct);
            return affected > 0 ? Ok(new { message = "Permission removed." }) : NotFound(new { message = "Role or permission not found." });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error deleting role permission for {Role}/{Permission}.", request.RoleName, request.PermissionKey);
            return Problem("Internal server error deleting role permission.");
        }
    }
}

public record UpsertRolePermissionRequest
{
    public string RoleName { get; init; } = string.Empty;
    public string PermissionKey { get; init; } = string.Empty;
    public bool IsEnabled { get; init; } = true;
}

public record DeleteRolePermissionRequest
{
    public string RoleName { get; init; } = string.Empty;
    public string PermissionKey { get; init; } = string.Empty;
}

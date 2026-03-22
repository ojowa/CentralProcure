using System.Data;
using System.Security.Claims;
using eProcurement.Modules.Identity.DTOs;
using eProcurement.Modules.Identity.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Identity.Controllers;

public partial class AuthController
{
    [Authorize]
    [HttpGet("internal/modules/catalog")]
    public IActionResult GetInternalModuleCatalog()
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        return Ok(InternalModuleCatalog.GetAllModules());
    }

    [Authorize]
    [HttpGet("internal/module-access/roles")]
    public async Task<IActionResult> GetRoleModuleAccess(CancellationToken ct)
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
            await using var cmd = new NpgsqlCommand("SELECT * FROM identity.get_role_module_grants();", conn);
            await using var reader = await cmd.ExecuteReaderAsync(ct);

            var results = new List<RoleModuleAccessGrantResult>();
            while (await reader.ReadAsync(ct))
            {
                results.Add(MapRoleModuleAccessGrantResult(reader));
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching role module access grants.");
            return Problem("Internal server error fetching role module access grants.");
        }
    }

    [Authorize]
    [HttpGet("internal/module-access/users")]
    public async Task<IActionResult> GetUserModuleAccess(CancellationToken ct)
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
            await using var cmd = new NpgsqlCommand("SELECT * FROM identity.get_user_module_grants();", conn);
            await using var reader = await cmd.ExecuteReaderAsync(ct);

            var results = new List<UserModuleAccessGrantResult>();
            while (await reader.ReadAsync(ct))
            {
                results.Add(MapUserModuleAccessGrantResult(reader));
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching user module access grants.");
            return Problem("Internal server error fetching user module access grants.");
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
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        limit = Math.Clamp(limit, 1, 500);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            var sql = @"
SELECT
    a.audit_id, a.target_type, r.role_name, iu.internal_user_id,
    iu.email, iu.username, a.module_id, a.previous_state, a.new_state,
    a.changed_by, a.change_source, a.changed_at
FROM identity.internal_module_grant_audit a
LEFT JOIN identity.roles r ON r.role_id = a.role_id
LEFT JOIN identity.internal_users iu ON iu.internal_user_id = a.internal_user_id
WHERE (@p_role_name IS NULL OR lower(r.role_name) = lower(@p_role_name))
  AND (@p_internal_user_id IS NULL OR a.internal_user_id = @p_internal_user_id)
ORDER BY a.changed_at DESC
LIMIT @p_limit;";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_role_name", NpgsqlDbType.Varchar, (object?)roleName ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, (object?)internalUserId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, limit);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            var results = new List<ModuleAccessAuditResult>();
            while (await reader.ReadAsync(ct))
            {
                results.Add(MapModuleAccessAuditResult(reader));
            }

            return Ok(results);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UndefinedTable)
        {
            Logger.LogWarning(ex, "Module access audit table is missing.");
            return Ok(Array.Empty<ModuleAccessAuditResult>());
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching module access audit.");
            return Problem("Internal server error fetching module access audit.");
        }
    }

    [Authorize]
    [HttpPut("internal/module-access/roles")]
    public async Task<IActionResult> UpdateRoleModuleAccess([FromBody] UpdateRoleModuleAccessRequest request, CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.RoleName) || string.IsNullOrWhiteSpace(request.ModuleId))
        {
            return BadRequest(new { message = "RoleName and ModuleId are required." });
        }

        if (!TryGetAuthenticatedInternalUserId(out var internalUserId, out var authError))
        {
            return authError!;
        }

        var moduleExists = InternalModuleCatalog
            .GetAllModules()
            .Any(module => string.Equals(module.Id, request.ModuleId, StringComparison.OrdinalIgnoreCase));
        if (!moduleExists)
        {
            return BadRequest(new { message = "Unknown module id." });
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
            await using var tx = await conn.BeginTransactionAsync(ct);

            var roleId = await ResolveRoleIdAsync(conn, tx, request.RoleName, ct);
            if (roleId is null)
            {
                return BadRequest(new { message = "Role not found." });
            }

            var previousState = await GetRoleGrantStateAsync(conn, tx, roleId.Value, request.ModuleId, ct);

            await using var cmd = new NpgsqlCommand(@"
SELECT * FROM identity.upsert_role_module_grant(
    @p_role_name, @p_module_id, @p_is_enabled, @p_updated_by);", conn, tx);

            cmd.Parameters.AddWithValue("p_role_name", NpgsqlDbType.Varchar, request.RoleName);
            cmd.Parameters.AddWithValue("p_module_id", NpgsqlDbType.Varchar, request.ModuleId);
            cmd.Parameters.AddWithValue("p_is_enabled", NpgsqlDbType.Boolean, request.IsEnabled);
            cmd.Parameters.AddWithValue("p_updated_by", NpgsqlDbType.Uuid, internalUserId);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                var result = MapRoleModuleAccessGrantResult(reader);
                await reader.CloseAsync();
                await WriteModuleAccessAuditAsync(
                    conn, tx, "role", roleId, null, request.ModuleId,
                    previousState, request.IsEnabled, internalUserId, "single", ct);
                await tx.CommitAsync(ct);
                return Ok(result);
            }

            await tx.CommitAsync(ct);
            return Ok(null);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error updating role module access for {RoleName} {ModuleId}.", request.RoleName, request.ModuleId);
            return Problem("Internal server error updating role module access.");
        }
    }

    [Authorize]
    [HttpPut("internal/module-access/users")]
    public async Task<IActionResult> UpdateUserModuleAccess([FromBody] UpdateUserModuleAccessRequest request, CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        if (request.InternalUserId == Guid.Empty || string.IsNullOrWhiteSpace(request.ModuleId))
        {
            return BadRequest(new { message = "InternalUserId and ModuleId are required." });
        }

        if (!TryGetAuthenticatedInternalUserId(out var internalUserId, out var authError))
        {
            return authError!;
        }

        var moduleExists = InternalModuleCatalog
            .GetAllModules()
            .Any(module => string.Equals(module.Id, request.ModuleId, StringComparison.OrdinalIgnoreCase));
        if (!moduleExists)
        {
            return BadRequest(new { message = "Unknown module id." });
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
            await using var tx = await conn.BeginTransactionAsync(ct);

            var previousState = await GetUserGrantStateAsync(conn, tx, request.InternalUserId, request.ModuleId, ct);

            await using var cmd = new NpgsqlCommand(@"
SELECT * FROM identity.upsert_user_module_grant(
    @p_internal_user_id, @p_module_id, @p_is_enabled, @p_updated_by);", conn, tx);

            cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, request.InternalUserId);
            cmd.Parameters.AddWithValue("p_module_id", NpgsqlDbType.Varchar, request.ModuleId);
            cmd.Parameters.AddWithValue("p_is_enabled", NpgsqlDbType.Boolean, request.IsEnabled);
            cmd.Parameters.AddWithValue("p_updated_by", NpgsqlDbType.Uuid, internalUserId);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                var result = MapUserModuleAccessGrantResult(reader);
                await reader.CloseAsync();
                await WriteModuleAccessAuditAsync(
                    conn, tx, "user", null, request.InternalUserId, request.ModuleId,
                    previousState, request.IsEnabled, internalUserId, "single", ct);
                await tx.CommitAsync(ct);
                return Ok(result);
            }

            await tx.CommitAsync(ct);
            return Ok(null);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error updating user module access for {UserId} {ModuleId}.", request.InternalUserId, request.ModuleId);
            return Problem("Internal server error updating user module access.");
        }
    }

    [Authorize]
    [HttpDelete("internal/module-access/roles")]
    public async Task<IActionResult> DeleteRoleModuleAccess(
        [FromQuery] string roleName,
        [FromQuery] string moduleId,
        CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(roleName) || string.IsNullOrWhiteSpace(moduleId))
        {
            return BadRequest(new { message = "roleName and moduleId are required." });
        }

        if (!TryGetAuthenticatedInternalUserId(out var internalUserId, out var authError))
        {
            return authError!;
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
            await using var tx = await conn.BeginTransactionAsync(ct);

            var roleId = await ResolveRoleIdAsync(conn, tx, roleName, ct);
            if (roleId is null)
            {
                return BadRequest(new { message = "Role not found." });
            }

            var previousState = await GetRoleGrantStateAsync(conn, tx, roleId.Value, moduleId, ct);
            if (previousState is null)
            {
                await tx.CommitAsync(ct);
                return NoContent();
            }

            await using var cmd = new NpgsqlCommand(@"
DELETE FROM identity.internal_module_grants
WHERE role_id = @p_role_id AND module_id = @p_module_id;", conn, tx);
            cmd.Parameters.AddWithValue("p_role_id", NpgsqlDbType.Uuid, roleId.Value);
            cmd.Parameters.AddWithValue("p_module_id", NpgsqlDbType.Varchar, moduleId);
            await cmd.ExecuteNonQueryAsync(ct);

            await WriteModuleAccessAuditAsync(
                conn,
                tx,
                "role",
                roleId,
                null,
                moduleId,
                previousState,
                null,
                internalUserId,
                "single_reset",
                ct);

            await tx.CommitAsync(ct);
            return NoContent();
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error resetting role module access for {RoleName} {ModuleId}.", roleName, moduleId);
            return Problem("Internal server error resetting role module access.");
        }
    }

    [Authorize]
    [HttpDelete("internal/module-access/users")]
    public async Task<IActionResult> DeleteUserModuleAccess(
        [FromQuery] Guid internalUserId,
        [FromQuery] string moduleId,
        CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        if (internalUserId == Guid.Empty || string.IsNullOrWhiteSpace(moduleId))
        {
            return BadRequest(new { message = "internalUserId and moduleId are required." });
        }

        if (!TryGetAuthenticatedInternalUserId(out var adminUserId, out var authError))
        {
            return authError!;
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
            await using var tx = await conn.BeginTransactionAsync(ct);

            var previousState = await GetUserGrantStateAsync(conn, tx, internalUserId, moduleId, ct);
            if (previousState is null)
            {
                await tx.CommitAsync(ct);
                return NoContent();
            }

            await using var cmd = new NpgsqlCommand(@"
DELETE FROM identity.internal_module_grants
WHERE internal_user_id = @p_internal_user_id AND module_id = @p_module_id;", conn, tx);
            cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);
            cmd.Parameters.AddWithValue("p_module_id", NpgsqlDbType.Varchar, moduleId);
            await cmd.ExecuteNonQueryAsync(ct);

            await WriteModuleAccessAuditAsync(
                conn,
                tx,
                "user",
                null,
                internalUserId,
                moduleId,
                previousState,
                null,
                adminUserId,
                "single_reset",
                ct);

            await tx.CommitAsync(ct);
            return NoContent();
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error resetting user module access for {UserId} {ModuleId}.", internalUserId, moduleId);
            return Problem("Internal server error resetting user module access.");
        }
    }

    private static async Task<Guid?> ResolveRoleIdAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string roleName,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(@"
SELECT role_id FROM identity.roles
WHERE lower(role_name) = lower(@p_role_name) LIMIT 1;", conn, tx);
        cmd.Parameters.AddWithValue("p_role_name", NpgsqlDbType.Varchar, roleName);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is Guid roleId ? roleId : null;
    }

    private static async Task<bool?> GetRoleGrantStateAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid roleId,
        string moduleId,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(@"
SELECT is_enabled FROM identity.internal_module_grants
WHERE role_id = @p_role_id AND module_id = @p_module_id;", conn, tx);
        cmd.Parameters.AddWithValue("p_role_id", NpgsqlDbType.Uuid, roleId);
        cmd.Parameters.AddWithValue("p_module_id", NpgsqlDbType.Varchar, moduleId);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is bool value ? value : null;
    }

    private static async Task<bool?> GetUserGrantStateAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid internalUserId,
        string moduleId,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(@"
SELECT is_enabled FROM identity.internal_module_grants
WHERE internal_user_id = @p_internal_user_id AND module_id = @p_module_id;", conn, tx);
        cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);
        cmd.Parameters.AddWithValue("p_module_id", NpgsqlDbType.Varchar, moduleId);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is bool value ? value : null;
    }

    private static async Task WriteModuleAccessAuditAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string targetType,
        Guid? roleId,
        Guid? internalUserId,
        string moduleId,
        bool? previousState,
        bool? newState,
        Guid? changedBy,
        string changeSource,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(@"
INSERT INTO identity.internal_module_grant_audit (
    target_type, role_id, internal_user_id, module_id,
    previous_state, new_state, changed_by, change_source
) VALUES (
    @p_target_type, @p_role_id, @p_internal_user_id, @p_module_id,
    @p_previous_state, @p_new_state, @p_changed_by, @p_change_source
);", conn, tx);

        cmd.Parameters.AddWithValue("p_target_type", NpgsqlDbType.Varchar, targetType);
        cmd.Parameters.AddWithValue("p_role_id", NpgsqlDbType.Uuid, (object?)roleId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, (object?)internalUserId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_module_id", NpgsqlDbType.Varchar, moduleId);
        cmd.Parameters.AddWithValue("p_previous_state", NpgsqlDbType.Boolean, (object?)previousState ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_new_state", NpgsqlDbType.Boolean, (object?)newState ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_changed_by", NpgsqlDbType.Uuid, (object?)changedBy ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_change_source", NpgsqlDbType.Varchar, changeSource);

        await cmd.ExecuteNonQueryAsync(ct);
    }
}

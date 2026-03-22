using System.Data;
using System.Security.Claims;
using eProcurement.Modules.Identity.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Identity.Controllers;

public partial class AuthController
{
    [Authorize]
    [HttpGet("internal/units")]
    public async Task<IActionResult> GetInternalUnits(CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            const string sql =
                """
                SELECT
                    ou.unit_id,
                    ou.unit_name,
                    ou.unit_code,
                    ou.unit_type,
                    ou.parent_unit_id,
                    parent.unit_name AS parent_unit_name,
                    ou.sort_order,
                    ou.is_assignable
                FROM identity.organizational_units ou
                LEFT JOIN identity.organizational_units parent ON parent.unit_id = ou.parent_unit_id
                WHERE ou.is_active = TRUE
                ORDER BY ou.sort_order ASC, ou.unit_name ASC
                """;

            await using var cmd = new NpgsqlCommand(sql, conn);
            await using var reader = await cmd.ExecuteReaderAsync(ct);

            var results = new List<InternalOrganizationalUnitResult>();
            while (await reader.ReadAsync(ct))
            {
                results.Add(MapInternalOrganizationalUnitResult(reader));
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching internal organizational units.");
            return Problem("Internal server error fetching internal organizational units.");
        }
    }

    [Authorize]
    [HttpDelete("internal/module-access/roles/bulk")]
    public async Task<IActionResult> DeleteRoleModuleAccessBulk([FromQuery] string roleName, CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(roleName))
        {
            return BadRequest(new { message = "roleName is required." });
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        if (!TryGetAuthenticatedInternalUserId(out var internalUserId, out var authError))
        {
            return authError!;
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

            var existing = await LoadRoleGrantsAsync(conn, tx, roleId.Value, ct);

            await using var cmd = new NpgsqlCommand(@"
DELETE FROM identity.internal_module_grants
WHERE role_id = @p_role_id;", conn, tx);
            cmd.Parameters.AddWithValue("p_role_id", NpgsqlDbType.Uuid, roleId.Value);
            await cmd.ExecuteNonQueryAsync(ct);

            foreach (var (moduleId, previousState) in existing)
            {
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
                    "reset_all",
                    ct);
            }

            await tx.CommitAsync(ct);
            return Ok(new { message = "Role module access reset." });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error deleting role module access for {RoleName}.", roleName);
            return Problem("Internal server error deleting role module access.");
        }
    }

    [Authorize]
    [HttpPut("internal/module-access/users/bulk")]
    public async Task<IActionResult> BulkUpdateUserModuleAccess([FromBody] BulkUserModuleAccessRequest request, CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        if (request.InternalUserId == Guid.Empty || request.Grants is null || request.Grants.Count == 0)
        {
            return BadRequest(new { message = "InternalUserId and grants are required." });
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

            var existing = await LoadUserGrantsAsync(conn, tx, request.InternalUserId, ct);

            foreach (var grant in request.Grants)
            {
                await using var cmd = new NpgsqlCommand(@"
SELECT * FROM identity.upsert_user_module_grant(
    @p_internal_user_id,
    @p_module_id,
    @p_is_enabled,
    @p_updated_by);", conn, tx);

                cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, request.InternalUserId);
                cmd.Parameters.AddWithValue("p_module_id", NpgsqlDbType.Varchar, grant.ModuleId);
                cmd.Parameters.AddWithValue("p_is_enabled", NpgsqlDbType.Boolean, grant.IsEnabled);
                cmd.Parameters.AddWithValue("p_updated_by", NpgsqlDbType.Uuid, internalUserId);

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                if (await reader.ReadAsync(ct))
                {
                    await reader.CloseAsync();
                }

                existing.TryGetValue(grant.ModuleId, out var previousState);
                await WriteModuleAccessAuditAsync(
                    conn,
                    tx,
                    "user",
                    null,
                    request.InternalUserId,
                    grant.ModuleId,
                    previousState,
                    grant.IsEnabled,
                    internalUserId,
                    "bulk",
                    ct);
            }

            await tx.CommitAsync(ct);
            return Ok(new { message = "User module access updated." });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error bulk updating user module access for {UserId}.", request.InternalUserId);
            return Problem("Internal server error bulk updating user module access.");
        }
    }

    [Authorize]
    [HttpDelete("internal/module-access/users/bulk")]
    public async Task<IActionResult> DeleteUserModuleAccessBulk([FromQuery] Guid internalUserId, CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        if (internalUserId == Guid.Empty)
        {
            return BadRequest(new { message = "internalUserId is required." });
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        if (!TryGetAuthenticatedInternalUserId(out var adminUserId, out var authError))
        {
            return authError!;
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var existing = await LoadUserGrantsAsync(conn, tx, internalUserId, ct);

            await using var cmd = new NpgsqlCommand(@"
DELETE FROM identity.internal_module_grants
WHERE internal_user_id = @p_internal_user_id;", conn, tx);
            cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);
            await cmd.ExecuteNonQueryAsync(ct);

            foreach (var (moduleId, previousState) in existing)
            {
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
                    "reset_all",
                    ct);
            }

            await tx.CommitAsync(ct);
            return Ok(new { message = "User module access reset." });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error deleting user module access for {UserId}.", internalUserId);
            return Problem("Internal server error deleting user module access.");
        }
    }

    private static async Task<Dictionary<string, bool>> LoadUserGrantsAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid internalUserId,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(@"
SELECT module_id, is_enabled
FROM identity.internal_module_grants
WHERE internal_user_id = @p_internal_user_id;", conn, tx);
        cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);

        var results = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results[reader.GetString(reader.GetOrdinal("module_id"))] = reader.GetBoolean(reader.GetOrdinal("is_enabled"));
        }

        return results;
    }

    private static async Task<Dictionary<string, bool>> LoadRoleGrantsAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid roleId,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(@"
SELECT module_id, is_enabled
FROM identity.internal_module_grants
WHERE role_id = @p_role_id;", conn, tx);
        cmd.Parameters.AddWithValue("p_role_id", NpgsqlDbType.Uuid, roleId);

        var results = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results[reader.GetString(reader.GetOrdinal("module_id"))] = reader.GetBoolean(reader.GetOrdinal("is_enabled"));
        }

        return results;
    }
}

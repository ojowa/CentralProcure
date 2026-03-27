using System.Data;
using eProcurement.Modules.Identity.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Identity.Controllers;

public partial class AuthController
{
    [Authorize]
    [HttpPost("roles")]
    public async Task<IActionResult> CreateRole([FromBody] CreateRoleRequest request, CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        Logger.LogInformation("Creating role {RoleName}", request.RoleName);
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        if (string.IsNullOrWhiteSpace(request.RoleName))
        {
            return BadRequest(new { message = "Role name is required." });
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("identity.create_role_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_role_name", NpgsqlDbType.Varchar, request.RoleName.Trim());
            cmd.Parameters.AddWithValue("p_description", NpgsqlDbType.Text, (object?)request.Description ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapRoleResult, ct);
            await tx.CommitAsync(ct);

            return Ok(results.FirstOrDefault());
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            Logger.LogWarning(ex, "Role creation failed - duplicate name {RoleName}", request.RoleName);
            return Conflict(new { message = "A role with this name already exists." });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error creating role {RoleName}", request.RoleName);
            return Problem("Internal server error creating role.");
        }
    }

    [Authorize]
    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles(CancellationToken ct)
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
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("identity.get_roles_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapRoleResult, ct);
            await tx.CommitAsync(ct);

            return Ok(results);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching roles.");
            return Problem("Internal server error fetching roles.");
        }
    }

    [Authorize]
    [HttpGet("roles/{roleId:guid}")]
    public async Task<IActionResult> GetRole(Guid roleId, CancellationToken ct)
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

            await using var cmd = new NpgsqlCommand(@"
                SELECT r.role_id, r.role_name, r.description, r.is_active,
                       COUNT(iu.internal_user_id) as user_count
                FROM identity.roles r
                LEFT JOIN identity.internal_users iu ON iu.role_id = r.role_id AND iu.is_active = TRUE
                WHERE r.role_id = @p_role_id
                GROUP BY r.role_id, r.role_name, r.description, r.is_active;", conn);

            cmd.Parameters.AddWithValue("p_role_id", NpgsqlDbType.Uuid, roleId);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                var result = new RoleDetailResult(
                    reader.GetGuid(reader.GetOrdinal("role_id")),
                    reader.GetString(reader.GetOrdinal("role_name")),
                    reader.IsDBNull(reader.GetOrdinal("description")) ? null : reader.GetString(reader.GetOrdinal("description")),
                    reader.GetBoolean(reader.GetOrdinal("is_active")),
                    reader.GetInt32(reader.GetOrdinal("user_count")));

                return Ok(result);
            }

            return NotFound(new { message = "Role not found." });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching role {RoleId}", roleId);
            return Problem("Internal server error fetching role.");
        }
    }

    [Authorize]
    [HttpPut("roles/{roleId:guid}")]
    public async Task<IActionResult> UpdateRole(Guid roleId, [FromBody] UpdateRoleRequest request, CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        Logger.LogInformation("Updating role {RoleId} to {RoleName}", roleId, request.RoleName);
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        if (string.IsNullOrWhiteSpace(request.RoleName))
        {
            return BadRequest(new { message = "Role name is required." });
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            var currentIsActive = await GetRoleIsActiveAsync(conn, tx, roleId, ct);
            if (currentIsActive is null)
            {
                return NotFound(new { message = "Role not found." });
            }

            await using var cmd = new NpgsqlCommand("identity.update_role_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_role_id", NpgsqlDbType.Uuid, roleId);
            cmd.Parameters.AddWithValue("p_role_name", NpgsqlDbType.Varchar, request.RoleName.Trim());
            cmd.Parameters.AddWithValue("p_description", NpgsqlDbType.Text, (object?)request.Description?.Trim() ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_is_active", NpgsqlDbType.Boolean, currentIsActive.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapRoleResult, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            return result is null ? NotFound(new { message = "Role not found." }) : Ok(result);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            Logger.LogWarning(ex, "Role update failed - duplicate name {RoleName}", request.RoleName);
            return Conflict(new { message = "A role with this name already exists." });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error updating role {RoleId}", roleId);
            return Problem("Internal server error updating role.");
        }
    }

    private static async Task<bool?> GetRoleIsActiveAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid roleId,
        CancellationToken ct)
    {
        const string sql = "SELECT is_active FROM identity.roles WHERE role_id = @p_role_id;";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_role_id", NpgsqlDbType.Uuid, roleId);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is bool isActive ? isActive : null;
    }

    [Authorize]
    [HttpDelete("roles/{roleId:guid}")]
    public async Task<IActionResult> DeactivateRole(Guid roleId, CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        Logger.LogInformation("Deactivating role {RoleId}", roleId);
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var checkCmd = new NpgsqlCommand(@"
                SELECT COUNT(*) FROM identity.internal_users
                WHERE role_id = @p_role_id AND is_active = TRUE;", conn);
            checkCmd.Parameters.AddWithValue("p_role_id", NpgsqlDbType.Uuid, roleId);

            var userCount = (long)(await checkCmd.ExecuteScalarAsync(ct) ?? 0);
            if (userCount > 0)
            {
                return Conflict(new { message = "Cannot deactivate role with active users. Please reassign users first." });
            }

            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("identity.deactivate_role_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_role_id", NpgsqlDbType.Uuid, roleId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapRoleResult, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            return result is null ? NotFound(new { message = "Role not found." }) : Ok(result);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error deactivating role {RoleId}", roleId);
            return Problem("Internal server error deactivating role.");
        }
    }

    [Authorize]
    [HttpGet("roles/{roleId:guid}/users")]
    public async Task<IActionResult> GetRoleUsers(Guid roleId, CancellationToken ct)
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

            await using var cmd = new NpgsqlCommand(@"
                SELECT iu.internal_user_id, iu.email, iu.username,
                       iu.first_name, iu.surname, iu.status
                FROM identity.internal_users iu
                WHERE iu.role_id = @p_role_id AND iu.is_active = TRUE
                ORDER BY iu.surname, iu.first_name;", conn);

            cmd.Parameters.AddWithValue("p_role_id", NpgsqlDbType.Uuid, roleId);

            var results = new List<RoleUserResult>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                results.Add(new RoleUserResult(
                    reader.GetGuid(reader.GetOrdinal("internal_user_id")),
                    reader.GetString(reader.GetOrdinal("email")),
                    reader.GetString(reader.GetOrdinal("username")),
                    reader.GetString(reader.GetOrdinal("first_name")),
                    reader.GetString(reader.GetOrdinal("surname")),
                    reader.GetString(reader.GetOrdinal("status"))));
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching users for role {RoleId}", roleId);
            return Problem("Internal server error fetching role users.");
        }
    }
}

public record UpdateRoleRequest(string RoleName, string? Description);

public record RoleDetailResult(Guid RoleId, string RoleName, string? Description, bool IsActive, int UserCount);

public record RoleUserResult(Guid InternalUserId, string Email, string Username, string FirstName, string Surname, string Status);

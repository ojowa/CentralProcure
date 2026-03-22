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
    [HttpGet("internal/users")]
    public async Task<IActionResult> GetInternalUsers(CancellationToken ct)
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
            await using var cmd = new NpgsqlCommand("identity.get_internal_users_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapInternalUserProfileResult, ct);
            await tx.CommitAsync(ct);

            return Ok(results);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching internal users.");
            return Problem("Internal server error fetching internal users.");
        }
    }

    [Authorize]
    [HttpPut("internal/users/{internalUserId:guid}")]
    public async Task<IActionResult> UpdateInternalUser(Guid internalUserId, [FromBody] UpdateInternalUserRequest request, CancellationToken ct)
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

        if (string.IsNullOrWhiteSpace(request.Username) ||
            string.IsNullOrWhiteSpace(request.FirstName) ||
            string.IsNullOrWhiteSpace(request.Surname))
        {
            return BadRequest(new { message = "Username, first name, and surname are required." });
        }

        if (!UsernamePattern.IsMatch(request.Username.Trim()))
        {
            return BadRequest(new { message = "Username must be 3-100 characters and may only include letters, numbers, periods, underscores, and hyphens." });
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            await using var cmd = new NpgsqlCommand("identity.update_internal_user_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);
            cmd.Parameters.AddWithValue("p_username", NpgsqlDbType.Varchar, request.Username.Trim());
            cmd.Parameters.AddWithValue("p_first_name", NpgsqlDbType.Varchar, request.FirstName.Trim());
            cmd.Parameters.AddWithValue("p_middle_name", NpgsqlDbType.Varchar, (object?)request.MiddleName?.Trim() ?? string.Empty);
            cmd.Parameters.AddWithValue("p_surname", NpgsqlDbType.Varchar, request.Surname.Trim());
            cmd.Parameters.AddWithValue("p_service_number", NpgsqlDbType.Varchar, request.ServiceNumber.Trim());
            cmd.Parameters.AddWithValue("p_unit_id", NpgsqlDbType.Uuid, (object?)request.UnitId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_is_active", NpgsqlDbType.Boolean, request.IsActive);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapInternalUserProfileResult, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            return result is null ? NotFound(new { message = "Internal user not found." }) : Ok(result);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            Logger.LogWarning(ex, "User update conflict for internal user {InternalUserId}.", internalUserId);
            return Conflict(new { message = "Username or service number is already in use." });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error updating internal user {InternalUserId}.", internalUserId);
            return Problem("Internal server error updating internal user.");
        }
    }

    [Authorize]
    [HttpPut("internal/users/{internalUserId:guid}/role")]
    public async Task<IActionResult> UpdateInternalUserRole(Guid internalUserId, [FromBody] UpdateInternalUserRoleRequest request, CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.Role))
        {
            return BadRequest(new { message = "Role is required." });
        }

        Logger.LogInformation("Updating role for internal user {UserId} to {Role}", internalUserId, request.Role);
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
            await using var cmd = new NpgsqlCommand("identity.update_internal_user_role_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);
            cmd.Parameters.AddWithValue("p_role_name", NpgsqlDbType.Varchar, request.Role);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapInternalUserRoleResult, ct);
            await tx.CommitAsync(ct);

            return Ok(results.FirstOrDefault());
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error updating role for user {UserId}", internalUserId);
            return Problem("Internal server error updating user role.");
        }
    }

    [Authorize]
    [HttpPut("internal/users/{internalUserId:guid}/status")]
    public async Task<IActionResult> UpdateInternalUserStatus(Guid internalUserId, [FromBody] UpdateUserStatusRequest request, CancellationToken ct)
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

            await using var cmd = new NpgsqlCommand("identity.update_internal_user_status_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, request.Status);
            cmd.Parameters.AddWithValue("p_is_active", NpgsqlDbType.Boolean, request.IsActive);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapInternalUserProfileResult, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            return result is null ? NotFound(new { message = "Internal user not found." }) : Ok(result);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error updating status for user {UserId}", internalUserId);
            return Problem("Internal server error updating user status.");
        }
    }

    [Authorize]
    [HttpDelete("internal/users/{internalUserId:guid}")]
    public async Task<IActionResult> DeactivateInternalUser(Guid internalUserId, CancellationToken ct)
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

            await using var cmd = new NpgsqlCommand(@"
                UPDATE identity.internal_users
                SET is_active = FALSE, status = 'Inactive', updated_at = NOW()
                WHERE internal_user_id = @p_internal_user_id
                RETURNING internal_user_id;", conn, tx);

            cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);

            var result = await cmd.ExecuteScalarAsync(ct);
            await tx.CommitAsync(ct);

            if (result is null)
            {
                return NotFound(new { message = "User not found." });
            }

            return Ok(new { message = "User deactivated successfully." });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error deactivating user {UserId}", internalUserId);
            return Problem("Internal server error deactivating user.");
        }
    }
}

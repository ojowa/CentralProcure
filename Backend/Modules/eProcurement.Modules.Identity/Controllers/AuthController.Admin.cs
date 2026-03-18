using System.Data;
using System.Security.Claims;
using System.Text.RegularExpressions;
using eProcurement.Modules.Identity.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Identity.Controllers;

public partial class AuthController
{
    [Authorize]
    [HttpPost("internal/register")]
    public async Task<IActionResult> InternalRegister([FromBody] InternalUserRegistrationRequest request, CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        Logger.LogInformation("Registering internal user {Email}", request.Email);
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        var validationError = ValidateInternalUserRegistration(request);
        if (validationError is not null)
        {
            return BadRequest(new { message = validationError });
        }

        try
        {
            var hash = BCrypt.Net.BCrypt.HashPassword(request.Password);

            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("identity.register_internal_user_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, request.Email.Trim());
            cmd.Parameters.AddWithValue("p_username", NpgsqlDbType.Varchar, request.Username.Trim());
            cmd.Parameters.AddWithValue("p_first_name", NpgsqlDbType.Varchar, request.FirstName.Trim());
            cmd.Parameters.AddWithValue("p_middle_name", NpgsqlDbType.Varchar, (object?)request.MiddleName?.Trim() ?? string.Empty);
            cmd.Parameters.AddWithValue("p_surname", NpgsqlDbType.Varchar, request.Surname.Trim());
            cmd.Parameters.AddWithValue("p_service_number", NpgsqlDbType.Varchar, request.ServiceNumber.Trim());
            cmd.Parameters.AddWithValue("p_unit_id", NpgsqlDbType.Uuid, request.UnitId!.Value);
            cmd.Parameters.AddWithValue("p_password_hash", NpgsqlDbType.Varchar, hash);
            cmd.Parameters.AddWithValue("p_role_name", NpgsqlDbType.Varchar, request.Role ?? "Internal");
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapInternalUserRegistrationResult, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            if (result is null)
            {
                return Problem("Failed to register internal user.");
            }

            var token = GenerateToken(result.InternalUserId, result.Email, result.Role);
            return Ok(new AuthResponse(token, result.Email, "Success", result.Role));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error registering internal user {Email}", request.Email);
            return Problem("Internal server error during internal registration.");
        }
    }

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

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("identity.create_role_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_role_name", NpgsqlDbType.Varchar, request.RoleName);
            cmd.Parameters.AddWithValue("p_description", NpgsqlDbType.Text, (object?)request.Description ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapRoleResult, ct);
            await tx.CommitAsync(ct);

            return Ok(results.FirstOrDefault());
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
    [HttpPut("internal/users/role")]
    public async Task<IActionResult> UpdateInternalUserRole([FromBody] UpdateInternalUserRoleRequest request, CancellationToken ct)
    {
        if (!IsIdentityAdministrator())
        {
            return Forbid();
        }

        Logger.LogInformation("Updating role for internal user {UserId} to {Role}", request.InternalUserId, request.Role);
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

            cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, request.InternalUserId);
            cmd.Parameters.AddWithValue("p_role_name", NpgsqlDbType.Varchar, request.Role);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapInternalUserRoleResult, ct);
            await tx.CommitAsync(ct);

            return Ok(results.FirstOrDefault());
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error updating role for user {UserId}", request.InternalUserId);
            return Problem("Internal server error updating user role.");
        }
    }

    private static string? NormalizeRoleKey(string? role)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            return null;
        }

        var trimmed = role.Trim();
        var withUnderscores = trimmed.Replace("-", "_").Replace(" ", "_");
        var snakeCase = Regex.Replace(withUnderscores, "([a-z0-9])([A-Z])", "$1_$2");
        return snakeCase.ToLowerInvariant();
    }

    private bool IsIdentityAdministrator()
    {
        var role = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
        if (string.IsNullOrWhiteSpace(role))
        {
            return false;
        }

        var normalized = NormalizeRoleKey(role);
        return string.Equals(normalized, "admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(normalized, "ict_admin", StringComparison.OrdinalIgnoreCase);
    }
}

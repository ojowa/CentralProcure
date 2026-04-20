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
    [AllowAnonymous]
    [HttpPost("internal/login")]
    public async Task<IActionResult> InternalLogin([FromBody] InternalLoginRequest request, CancellationToken ct)
    {
        Logger.LogInformation("Internal login attempt for {Email}", request.Email);
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            var credentials = await ResolveInternalUserCredentialsAsync(conn, request.Email, ct);
            var resolvedEmail = credentials.Email;
            var verifiedPasswordHash = await ResolveVerifiedInternalPasswordHashAsync(
                conn,
                request.Email,
                request.Password,
                credentials,
                ct);
            var isPasswordValid = !string.IsNullOrWhiteSpace(verifiedPasswordHash);

            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("identity.internal_login_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, resolvedEmail ?? request.Email);
            cmd.Parameters.AddWithValue(
                "p_password_hash",
                NpgsqlDbType.Varchar,
                isPasswordValid ? verifiedPasswordHash! : "INVALID_HASH_TO_TRIGGER_SP_FAILURE");
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapInternalLoginResult, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            if (result is null || !string.IsNullOrWhiteSpace(result.ErrorMessage))
            {
                Logger.LogWarning("Internal login failed for {Email}: {ErrorMessage}", request.Email, result?.ErrorMessage ?? "Unknown error");
                return Unauthorized(new { message = result?.ErrorMessage ?? "Login failed." });
            }

            if (result.InternalUserId is null)
            {
                Logger.LogWarning("Internal login failed for {Email}: InternalUserID is null after successful SP call.", request.Email);
                return Unauthorized(new { message = "Login failed." });
            }

            if (string.IsNullOrWhiteSpace(result.Role))
            {
                Logger.LogError("Internal login failed for {Email}: role is missing for authenticated internal user {InternalUserId}.", request.Email, result.InternalUserId);
                return Problem("Internal user role is not configured.", statusCode: 500);
            }

            var role = result.Role;
            var token = GenerateToken(result.InternalUserId.Value, result.Email ?? resolvedEmail ?? request.Email, role, result.SecurityStamp);
            SetAuthCookie(InternalAuthCookieName, token);
            SetInternalSessionActivityCookie(result.InternalUserId.Value);
            return Ok(new
            {
                Token = token,
                Email = result.Email ?? resolvedEmail ?? request.Email,
                Status = result.Status ?? "Success",
                Role = role,
                CanonicalRoleKey = result.CanonicalRoleKey,
                InternalUserId = result.InternalUserId.Value
            });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error during internal login for {Email}", request.Email);
            return Problem("Internal server error during login.");
        }
    }

    [Authorize]
    [HttpGet("internal/profile")]
    public async Task<IActionResult> GetInternalProfile(CancellationToken ct)
    {
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
            await using var cmd = new NpgsqlCommand("identity.get_internal_user_profile_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapInternalUserProfileResult, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            return result is null ? NotFound(new { message = "Internal user profile not found." }) : Ok(result);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching internal profile for user {InternalUserId}.", internalUserId);
            return Problem("Internal server error fetching internal profile.");
        }
    }

    [Authorize]
    [HttpPut("internal/profile")]
    public async Task<IActionResult> UpdateInternalProfile([FromBody] UpdateInternalUserProfileRequest request, CancellationToken ct)
    {
        if (!TryGetAuthenticatedInternalUserId(out var internalUserId, out var authError))
        {
            return authError!;
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

        if (!NamePattern.IsMatch(request.FirstName.Trim()) ||
            !string.IsNullOrWhiteSpace(request.MiddleName) && !NamePattern.IsMatch(request.MiddleName.Trim()) ||
            !NamePattern.IsMatch(request.Surname.Trim()))
        {
            return BadRequest(new { message = "Names may only include letters, spaces, apostrophes, and hyphens." });
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
            await using var cmd = new NpgsqlCommand("identity.update_internal_user_profile_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);
            cmd.Parameters.AddWithValue("p_username", NpgsqlDbType.Varchar, request.Username.Trim());
            cmd.Parameters.AddWithValue("p_first_name", NpgsqlDbType.Varchar, request.FirstName.Trim());
            cmd.Parameters.AddWithValue("p_middle_name", NpgsqlDbType.Varchar, (object?)request.MiddleName?.Trim() ?? string.Empty);
            cmd.Parameters.AddWithValue("p_surname", NpgsqlDbType.Varchar, request.Surname.Trim());
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapInternalUserProfileResult, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            return result is null ? NotFound(new { message = "Internal user profile not found." }) : Ok(result);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            Logger.LogWarning(ex, "Profile update conflict for internal user {InternalUserId}.", internalUserId);
            return Conflict(new { message = "That username is already in use." });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error updating internal profile for user {InternalUserId}.", internalUserId);
            return Problem("Internal server error updating internal profile.");
        }
    }

    [Authorize]
    [HttpGet("internal/modules")]
    public async Task<IActionResult> GetInternalModules(CancellationToken ct)
    {
        var role = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
        if (string.IsNullOrWhiteSpace(role))
        {
            return Unauthorized(new { message = "Authenticated role is missing." });
        }

        if (!TryGetAuthenticatedInternalUserId(out var internalUserId, out var authError))
        {
            return authError!;
        }

        var connectionString = GetConnectionString();
        var workflowActions = string.IsNullOrWhiteSpace(connectionString)
            ? Array.Empty<string>()
            : await _workflowActionGrantService.GetRoleModuleActionsAsync(connectionString, role, ct);

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Database connection is not available.");
        }

        var baseModules = await InternalModuleCatalog.GetModulesForRoleAsync(connectionString, role, workflowActions, ct);
        var catalogModules = await InternalModuleCatalog.GetAllModulesAsync(connectionString, workflowActions, ct);
        var roleGrants = await LoadRoleModuleGrantsAsync(connectionString, role, ct);
        var userGrants = await LoadUserModuleGrantsAsync(connectionString, internalUserId, ct);

        var finalModules = ApplyModuleGrants(baseModules, catalogModules, roleGrants, userGrants);
        return Ok(finalModules);
    }
}

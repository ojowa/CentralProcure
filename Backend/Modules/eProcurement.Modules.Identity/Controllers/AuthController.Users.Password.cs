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
    [HttpPost("internal/users/{internalUserId:guid}/reset-password")]
    public async Task<IActionResult> AdminResetPassword(Guid internalUserId, [FromBody] AdminResetPasswordRequest request, CancellationToken ct)
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

        if (!TryGetAuthenticatedInternalUserId(out var adminUserId, out var authError))
        {
            return authError!;
        }

        var passwordValidation = ValidatePasswordStrength(request.NewPassword);
        if (passwordValidation is not null)
        {
            return BadRequest(new { message = passwordValidation });
        }

        try
        {
            var hash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            await using var cmd = new NpgsqlCommand("identity.admin_reset_password_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);
            cmd.Parameters.AddWithValue("p_new_password_hash", NpgsqlDbType.Varchar, hash);
            cmd.Parameters.AddWithValue("p_reset_by", NpgsqlDbType.Uuid, adminUserId);
            cmd.Parameters.AddWithValue("p_require_change", NpgsqlDbType.Boolean, request.RequireChangeOnNextLogin);

            await cmd.ExecuteNonQueryAsync(ct);

            await WritePasswordAuditAsync(conn, tx, internalUserId, adminUserId, "admin_reset", null, ct);

            await tx.CommitAsync(ct);

            Logger.LogInformation("Admin {AdminId} reset password for user {UserId}", adminUserId, internalUserId);
            return Ok(new { message = "Password reset successfully." });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error resetting password for user {UserId}", internalUserId);
            return Problem("Internal server error resetting password.");
        }
    }

    private static async Task WritePasswordAuditAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid internalUserId,
        Guid? changedBy,
        string action,
        string? ipAddress,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(@"
INSERT INTO identity.password_audit (
    internal_user_id, action, changed_by, ip_address
) VALUES (
    @p_internal_user_id, @p_action, @p_changed_by, @p_ip_address
);", conn, tx);

        cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);
        cmd.Parameters.AddWithValue("p_action", NpgsqlDbType.Varchar, action);
        cmd.Parameters.AddWithValue("p_changed_by", NpgsqlDbType.Uuid, (object?)changedBy ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_ip_address", NpgsqlDbType.Inet, (object?)ipAddress ?? DBNull.Value);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    private string? ValidatePasswordStrength(string password)
    {
        if (password.Length < InternalPasswordMinLength)
        {
            return $"Password must be at least {InternalPasswordMinLength} characters long.";
        }

        if (!HasUppercase.IsMatch(password))
        {
            return "Password must contain at least one uppercase letter.";
        }

        if (!HasLowercase.IsMatch(password))
        {
            return "Password must contain at least one lowercase letter.";
        }

        if (!HasDigit.IsMatch(password))
        {
            return "Password must contain at least one digit.";
        }

        if (!HasSymbol.IsMatch(password))
        {
            return "Password must contain at least one special character.";
        }

        return null;
    }
}

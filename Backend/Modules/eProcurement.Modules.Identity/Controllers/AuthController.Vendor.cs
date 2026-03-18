using System.Data;
using eProcurement.Modules.Identity.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Identity.Controllers;

public partial class AuthController
{
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        Logger.LogInformation("Login attempt for {Email}", request.Email);
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            var credentials = await ResolveVendorCredentialsAsync(conn, request.Email, ct);
            var resolvedEmail = credentials.Email;
            var verifiedPasswordHash = await ResolveVerifiedVendorPasswordHashAsync(
                conn,
                request.Email,
                request.Password,
                credentials,
                ct);

            if (string.IsNullOrWhiteSpace(verifiedPasswordHash))
            {
                Logger.LogWarning("Invalid vendor credentials for {Email}", request.Email);
                return Unauthorized(new { message = "Invalid credentials." });
            }

            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("identity.login_vendor_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, resolvedEmail ?? request.Email);
            cmd.Parameters.AddWithValue("p_password_hash", NpgsqlDbType.Varchar, verifiedPasswordHash);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapVendorLoginResult, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            if (result is null || result.VendorId is null)
            {
                var vendorStatus = result?.VendorStatus;
                var message = ResolveVendorLoginFailureMessage(result?.ErrorMessage, vendorStatus);
                var statusCode = string.IsNullOrWhiteSpace(vendorStatus) ? 401 : 403;

                return StatusCode(statusCode, new
                {
                    message,
                    status = vendorStatus
                });
            }

            var token = GenerateToken(result.VendorId.Value, result.Email ?? resolvedEmail ?? request.Email, "vendor");
            SetAuthCookie(VendorAuthCookieName, token);
            return Ok(new AuthResponse(token, result.Email ?? resolvedEmail ?? request.Email, "Success"));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error during login for {Email}", request.Email);
            return Problem("Internal server error during login.");
        }
    }

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] VendorRegistrationRequest request, CancellationToken ct)
    {
        Logger.LogInformation("Registering vendor {Email}", request.Email);
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        if (string.IsNullOrWhiteSpace(request.RegistrationNumber) ||
            string.IsNullOrWhiteSpace(request.TaxID) ||
            string.IsNullOrWhiteSpace(request.CompanyAddress) ||
            string.IsNullOrWhiteSpace(request.ContactPerson) ||
            string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            return BadRequest(new
            {
                message = "Registration number, tax ID, company address, contact person, and phone number are required."
            });
        }

        var validationError = ValidateVendorRegistration(request);
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
            await using var cmd = new NpgsqlCommand("identity.register_vendor_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_company_name", NpgsqlDbType.Varchar, request.CompanyName);
            cmd.Parameters.AddWithValue("p_registration_number", NpgsqlDbType.Varchar, request.RegistrationNumber);
            cmd.Parameters.AddWithValue("p_tax_id", NpgsqlDbType.Varchar, request.TaxID);
            cmd.Parameters.AddWithValue("p_company_address", NpgsqlDbType.Text, request.CompanyAddress);
            cmd.Parameters.AddWithValue("p_contact_person", NpgsqlDbType.Varchar, request.ContactPerson);
            cmd.Parameters.AddWithValue("p_phone_number", NpgsqlDbType.Varchar, request.PhoneNumber);
            cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, request.Email);
            cmd.Parameters.AddWithValue("p_password_hash", NpgsqlDbType.Varchar, hash);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapVendorRegistrationResult, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            if (result is null)
            {
                return Problem("Failed to register vendor.");
            }

            var token = GenerateToken(result.VendorId, result.Email, "vendor");
            SetAuthCookie(VendorAuthCookieName, token);
            return Ok(new AuthResponse(token, result.Email, "Success"));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error registering vendor {Email}", request.Email);
            return Problem("Internal server error during registration.");
        }
    }

    private static string ResolveVendorLoginFailureMessage(string? errorMessage, string? vendorStatus)
    {
        if (string.IsNullOrWhiteSpace(vendorStatus))
        {
            return string.IsNullOrWhiteSpace(errorMessage) ? "Login failed." : errorMessage;
        }

        return vendorStatus.Trim().ToLowerInvariant() switch
        {
            "pending approval" => "Your vendor account is pending approval. You can sign in after procurement activates it.",
            "pending" => "Your vendor account is pending approval. You can sign in after procurement activates it.",
            "rejected" => "Your vendor account was rejected. Contact procurement support for next steps.",
            "suspended" => "Your vendor account has been suspended. Contact procurement support for assistance.",
            _ => string.IsNullOrWhiteSpace(errorMessage)
                ? $"Your vendor account is currently '{vendorStatus}'."
                : errorMessage
        };
    }
}

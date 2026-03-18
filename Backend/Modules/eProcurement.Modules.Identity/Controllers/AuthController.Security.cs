using System.Security.Cryptography;
using System.Text;
using eProcurement.Modules.Identity.DTOs;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Identity.Controllers;

public partial class AuthController
{
    private bool IsValidBcryptPassword(string passwordWithPepper, string? storedHash, string email)
    {
        if (string.IsNullOrWhiteSpace(storedHash))
        {
            BCrypt.Net.BCrypt.Verify(passwordWithPepper, BCrypt.Net.BCrypt.HashPassword("dummy_password"));
            return false;
        }

        if (!LooksLikeBcryptHash(storedHash))
        {
            return false;
        }

        try
        {
            return BCrypt.Net.BCrypt.Verify(passwordWithPepper, storedHash);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "BCrypt verification error for {Email}", email);
            return false;
        }
    }

    private async Task<string?> ResolveVerifiedInternalPasswordHashAsync(
        NpgsqlConnection conn,
        string identifier,
        string password,
        (string? Email, string? PasswordHash) credentials,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(credentials.PasswordHash))
        {
            BCrypt.Net.BCrypt.Verify(password, BCrypt.Net.BCrypt.HashPassword("dummy_password"));
            return null;
        }

        if (IsValidBcryptPassword(password, credentials.PasswordHash, identifier))
        {
            return credentials.PasswordHash;
        }

        if (!TryVerifyLegacyInternalPassword(password, credentials.PasswordHash, out var upgradedHash))
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(credentials.Email) || string.IsNullOrWhiteSpace(upgradedHash))
        {
            return null;
        }

        await UpgradeInternalUserPasswordHashAsync(conn, credentials.Email, upgradedHash, ct);
        Logger.LogInformation("Upgraded legacy password hash for internal user {Email}", credentials.Email);
        return upgradedHash;
    }

    private async Task<string?> ResolveVerifiedVendorPasswordHashAsync(
        NpgsqlConnection conn,
        string identifier,
        string password,
        (string? Email, string? PasswordHash) credentials,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(credentials.PasswordHash))
        {
            BCrypt.Net.BCrypt.Verify(password, BCrypt.Net.BCrypt.HashPassword("dummy_password"));
            return null;
        }

        if (IsValidBcryptPassword(password, credentials.PasswordHash, identifier))
        {
            return credentials.PasswordHash;
        }

        if (!TryVerifyLegacyPassword(password, credentials.PasswordHash, out var upgradedHash))
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(credentials.Email) || string.IsNullOrWhiteSpace(upgradedHash))
        {
            return null;
        }

        await UpgradeVendorPasswordHashAsync(conn, credentials.Email, upgradedHash, ct);
        Logger.LogInformation("Upgraded legacy password hash for vendor {Email}", credentials.Email);
        return upgradedHash;
    }

    private async Task UpgradeInternalUserPasswordHashAsync(
        NpgsqlConnection conn,
        string email,
        string upgradedHash,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE identity.internal_users
            SET password_hash = @p_password_hash
            WHERE lower(email) = lower(@p_email)
            """,
            conn);

        cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, email);
        cmd.Parameters.AddWithValue("p_password_hash", NpgsqlDbType.Varchar, upgradedHash);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private async Task UpgradeVendorPasswordHashAsync(
        NpgsqlConnection conn,
        string email,
        string upgradedHash,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE identity.vendors
            SET password_hash = @p_password_hash
            WHERE lower(email) = lower(@p_email)
            """,
            conn);

        cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, email);
        cmd.Parameters.AddWithValue("p_password_hash", NpgsqlDbType.Varchar, upgradedHash);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static bool TryVerifyLegacyInternalPassword(string password, string storedHash, out string? upgradedHash)
        => TryVerifyLegacyPassword(password, storedHash, out upgradedHash);

    private static bool TryVerifyLegacyPassword(string password, string storedHash, out string? upgradedHash)
    {
        upgradedHash = null;

        var isSha256Match =
            IsSha256Hex(storedHash) &&
            string.Equals(ComputeSha256Hex(password), storedHash, StringComparison.OrdinalIgnoreCase);
        var isPlainTextMatch = string.Equals(password, storedHash, StringComparison.Ordinal);

        if (!isSha256Match && !isPlainTextMatch)
        {
            return false;
        }

        upgradedHash = BCrypt.Net.BCrypt.HashPassword(password);
        return true;
    }

    private static bool LooksLikeBcryptHash(string value)
        => value.StartsWith("$2a$", StringComparison.Ordinal) ||
           value.StartsWith("$2b$", StringComparison.Ordinal) ||
           value.StartsWith("$2y$", StringComparison.Ordinal);

    private static bool IsSha256Hex(string value)
    {
        if (value.Length != 64)
        {
            return false;
        }

        foreach (var character in value)
        {
            if (!Uri.IsHexDigit(character))
            {
                return false;
            }
        }

        return true;
    }

    private static string ComputeSha256Hex(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        var builder = new StringBuilder(bytes.Length * 2);
        foreach (var item in bytes)
        {
            builder.Append(item.ToString("x2"));
        }

        return builder.ToString();
    }

    private static string? ValidateInternalUserRegistration(InternalUserRegistrationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return "Email is required.";
        }

        if (!request.Email.Contains('@', StringComparison.Ordinal))
        {
            return "A valid internal email address is required.";
        }

        if (string.IsNullOrWhiteSpace(request.Role))
        {
            return "Role is required.";
        }

        if (string.IsNullOrWhiteSpace(request.Username))
        {
            return "Username is required.";
        }

        if (!UsernamePattern.IsMatch(request.Username.Trim()))
        {
            return "Username must be 3-100 characters and use only letters, numbers, dot, underscore, or hyphen.";
        }

        if (string.IsNullOrWhiteSpace(request.FirstName))
        {
            return "First name is required.";
        }

        if (!NamePattern.IsMatch(request.FirstName.Trim()))
        {
            return "First name contains invalid characters.";
        }

        if (!string.IsNullOrWhiteSpace(request.MiddleName) && !NamePattern.IsMatch(request.MiddleName.Trim()))
        {
            return "Middle name contains invalid characters.";
        }

        if (string.IsNullOrWhiteSpace(request.Surname))
        {
            return "Surname is required.";
        }

        if (!NamePattern.IsMatch(request.Surname.Trim()))
        {
            return "Surname contains invalid characters.";
        }

        if (string.IsNullOrWhiteSpace(request.ServiceNumber))
        {
            return "Service number is required.";
        }

        if (!ServiceNumberPattern.IsMatch(request.ServiceNumber.Trim()))
        {
            return "Service number must be 3-100 characters and use only letters, numbers, slash, or hyphen.";
        }

        if (!request.UnitId.HasValue || request.UnitId.Value == Guid.Empty)
        {
            return "Organizational unit is required.";
        }

        return ValidateInternalPassword(request.Password);
    }

    private static string? ValidateVendorRegistration(VendorRegistrationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return "Email is required.";
        }

        if (!request.Email.Contains('@', StringComparison.Ordinal))
        {
            return "A valid vendor email address is required.";
        }

        if (string.IsNullOrWhiteSpace(request.CompanyName))
        {
            return "Company name is required.";
        }

        if (string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            return "Phone number is required.";
        }

        if (!PhoneNumberPattern.IsMatch(request.PhoneNumber.Trim()))
        {
            return "Phone number must be 7-20 characters and may include digits, spaces, parentheses, hyphen, or leading +.";
        }

        return ValidateInternalPassword(request.Password);
    }

    private static string? ValidateInternalPassword(string? password)
    {
        if (string.IsNullOrWhiteSpace(password))
        {
            return "Password is required.";
        }

        if (password.Length < InternalPasswordMinLength)
        {
            return $"Password must be at least {InternalPasswordMinLength} characters.";
        }

        if (!HasUppercase.IsMatch(password) || !HasLowercase.IsMatch(password))
        {
            return "Password must include both uppercase and lowercase letters.";
        }

        if (!HasDigit.IsMatch(password))
        {
            return "Password must include at least one number.";
        }

        if (!HasSymbol.IsMatch(password))
        {
            return "Password must include at least one special character.";
        }

        return null;
    }

    private static async Task<(string? Email, string? PasswordHash)> ResolveInternalUserCredentialsAsync(
        NpgsqlConnection conn,
        string identifier,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(
            """
            SELECT iu.email, iu.password_hash
            FROM identity.internal_users iu
            WHERE lower(iu.email) = lower(@identifier)
               OR lower(iu.username) = lower(@identifier)
               OR lower(iu.service_number) = lower(@identifier)
               OR lower(split_part(iu.email, '@', 1)) = lower(@identifier)
            ORDER BY CASE
                WHEN lower(iu.email) = lower(@identifier) THEN 0
                WHEN lower(iu.username) = lower(@identifier) THEN 1
                WHEN lower(iu.service_number) = lower(@identifier) THEN 2
                ELSE 3
            END
            LIMIT 1
            """,
            conn);

        cmd.Parameters.AddWithValue("identifier", NpgsqlDbType.Varchar, identifier.Trim());

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return (null, null);
        }

        return (
            GetNullableString(reader, "email"),
            GetNullableString(reader, "password_hash"));
    }

    private static async Task<(string? Email, string? PasswordHash)> ResolveVendorCredentialsAsync(
        NpgsqlConnection conn,
        string identifier,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(
            """
            SELECT email, password_hash
            FROM identity.vendors
            WHERE lower(email) = lower(@identifier)
            LIMIT 1
            """,
            conn);

        cmd.Parameters.AddWithValue("identifier", NpgsqlDbType.Varchar, identifier.Trim());

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return (null, null);
        }

        return (
            GetNullableString(reader, "email"),
            GetNullableString(reader, "password_hash"));
    }
}

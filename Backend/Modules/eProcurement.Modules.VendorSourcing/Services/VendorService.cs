using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.VendorSourcing.DTOs;

namespace eProcurement.Modules.VendorSourcing.Services;

public class VendorService : IVendorService
{
    private const int VendorPasswordMinLength = 8;
    private static readonly Regex HasUppercase = new("[A-Z]", RegexOptions.Compiled);
    private static readonly Regex HasLowercase = new("[a-z]", RegexOptions.Compiled);
    private static readonly Regex HasDigit = new("[0-9]", RegexOptions.Compiled);
    private static readonly Regex HasSymbol = new("[^a-zA-Z0-9]", RegexOptions.Compiled);
    private static readonly Regex PhoneNumberPattern = new(@"^\+?[0-9 ()-]{7,20}$", RegexOptions.Compiled);
    private readonly IConfiguration _config;
    private readonly ILogger<VendorService> _logger;

    public VendorService(IConfiguration config, ILogger<VendorService> logger)
    {
        _config = config;
        _logger = logger;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    public async Task<VendorRegistrationResult> RegisterAsync(RegisterVendorRequest request, CancellationToken ct)
    {
        var validationError = ValidateVendorRegistration(request);
        if (validationError is not null) throw new ArgumentException(validationError);

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("identity.register_vendor_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_company_name", NpgsqlDbType.Varchar, request.CompanyName);
        cmd.Parameters.AddWithValue("p_registration_number", NpgsqlDbType.Varchar, request.RegistrationNumber);
        cmd.Parameters.AddWithValue("p_tax_id", NpgsqlDbType.Varchar, request.TaxId);
        cmd.Parameters.AddWithValue("p_company_address", NpgsqlDbType.Text, request.CompanyAddress);
        cmd.Parameters.AddWithValue("p_contact_person", NpgsqlDbType.Varchar, request.ContactPerson);
        cmd.Parameters.AddWithValue("p_phone_number", NpgsqlDbType.Varchar, request.PhoneNumber);
        cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, request.Email);
        cmd.Parameters.AddWithValue("p_password_hash", NpgsqlDbType.Varchar, passwordHash);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
        var results = await ExecuteRefcursorAsync(cmd, MapVendorRegistrationResult, ct);
        var result = results.FirstOrDefault() ?? throw new InvalidOperationException("Registration failed.");
        await tx.CommitAsync(ct);
        return result;
    }

    public async Task<VendorLoginResult> LoginAsync(VendorLoginRequest request, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        var credentials = await ResolveVendorCredentialsAsync(conn, request.Email, ct);
        var verifiedHash = await ResolveVerifiedVendorPasswordHashAsync(conn, request.Email, request.Password, credentials, ct);
        if (string.IsNullOrWhiteSpace(verifiedHash)) return new VendorLoginResult(null, null, null, null, "Invalid credentials.");

        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("identity.login_vendor_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, credentials.Email ?? request.Email);
        cmd.Parameters.AddWithValue("p_password_hash", NpgsqlDbType.Varchar, verifiedHash);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
        var results = await ExecuteRefcursorAsync(cmd, MapVendorLoginResult, ct);
        await tx.CommitAsync(ct);
        return results.FirstOrDefault() ?? new VendorLoginResult(null, null, null, null, "Login failed.");
    }

    public async Task<VendorProfile?> GetProfileAsync(Guid vendorId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("identity.get_vendor_profile_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, vendorId);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
        var results = await ExecuteRefcursorAsync(cmd, MapVendorProfile, ct);
        await tx.CommitAsync(ct);
        return results.FirstOrDefault();
    }

    public async Task<VendorProfile> UpdateProfileAsync(Guid vendorId, UpdateVendorProfileRequest request, CancellationToken ct)
    {
        var validationError = ValidateVendorProfileUpdate(request);
        if (validationError is not null) throw new ArgumentException(validationError);

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("identity.update_vendor_profile_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, vendorId);
        cmd.Parameters.AddWithValue("p_company_name", NpgsqlDbType.Varchar, (object?)request.CompanyName ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_company_address", NpgsqlDbType.Text, (object?)request.CompanyAddress ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_contact_person", NpgsqlDbType.Varchar, (object?)request.ContactPerson ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_phone_number", NpgsqlDbType.Varchar, (object?)request.PhoneNumber ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, (object?)request.Email ?? DBNull.Value);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
        var results = await ExecuteRefcursorAsync(cmd, MapVendorProfile, ct);
        var result = results.FirstOrDefault() ?? throw new KeyNotFoundException("Vendor not found.");
        await tx.CommitAsync(ct);
        return result;
    }

    public async Task<(bool EmailAvailable, bool RegistrationAvailable, bool TaxAvailable)> CheckAvailabilityAsync(string? email, string? registrationNumber, string? taxId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        const string sql = @"
            SELECT CASE WHEN @p_email IS NULL THEN FALSE ELSE EXISTS (SELECT 1 FROM identity.vendors WHERE email = @p_email) END AS email_exists,
                   CASE WHEN @p_registration IS NULL THEN FALSE ELSE EXISTS (SELECT 1 FROM identity.vendors WHERE registration_number = @p_registration) END AS reg_exists,
                   CASE WHEN @p_tax IS NULL THEN FALSE ELSE EXISTS (SELECT 1 FROM identity.vendors WHERE tax_id = @p_tax) END AS tax_exists;";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, (object?)email ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_registration", NpgsqlDbType.Varchar, (object?)registrationNumber ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_tax", NpgsqlDbType.Varchar, (object?)taxId ?? DBNull.Value);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return (true, true, true);
        return (!reader.GetBoolean(0), !reader.GetBoolean(1), !reader.GetBoolean(2));
    }

    private static async Task<List<T>> ExecuteRefcursorAsync<T>(NpgsqlCommand cmd, Func<NpgsqlDataReader, T> map, CancellationToken ct)
    {
        await cmd.ExecuteNonQueryAsync(ct);
        var cursorName = (string)cmd.Parameters["p_result"].Value!;
        await using var fetch = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", cmd.Connection!, cmd.Transaction);
        await using var reader = await fetch.ExecuteReaderAsync(ct);
        var results = new List<T>();
        while (await reader.ReadAsync(ct)) results.Add(map(reader));
        return results;
    }

    private static VendorRegistrationResult MapVendorRegistrationResult(NpgsqlDataReader r) => new(r.GetGuid(0), r.GetString(1), r.GetString(2));
    private static VendorLoginResult MapVendorLoginResult(NpgsqlDataReader r) => new(r.IsDBNull(0) ? null : r.GetGuid(0), r.IsDBNull(1) ? null : r.GetString(1), r.IsDBNull(2) ? null : r.GetString(2), r.IsDBNull(3) ? null : r.GetString(3), r.IsDBNull(4) ? null : r.GetString(4));
    private static VendorProfile MapVendorProfile(NpgsqlDataReader r) => new(r.GetGuid(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4), r.GetString(5), r.IsDBNull(6) ? null : r.GetString(6), r.GetString(7), r.IsDBNull(8) ? null : r.GetDateTime(8), r.IsDBNull(9) ? null : r.GetDateTime(9), r.GetString(10));

    private async Task<string?> ResolveVerifiedVendorPasswordHashAsync(NpgsqlConnection conn, string identifier, string password, (string? Email, string? PasswordHash) credentials, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(credentials.PasswordHash)) { BCrypt.Net.BCrypt.Verify(password, BCrypt.Net.BCrypt.HashPassword("dummy_password")); return null; }
        if (IsValidBcryptPassword(password, credentials.PasswordHash, identifier)) return credentials.PasswordHash;
        if (!TryVerifyLegacyPassword(password, credentials.PasswordHash, out var upgradedHash)) return null;
        if (string.IsNullOrWhiteSpace(credentials.Email) || string.IsNullOrWhiteSpace(upgradedHash)) return null;
        await UpgradeVendorPasswordHashAsync(conn, credentials.Email, upgradedHash, ct);
        _logger.LogInformation("Upgraded legacy password hash for vendor {Email}", credentials.Email);
        return upgradedHash;
    }

    private static async Task<(string? Email, string? PasswordHash)> ResolveVendorCredentialsAsync(NpgsqlConnection conn, string identifier, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("SELECT email, password_hash FROM identity.vendors WHERE lower(email) = lower(@identifier) LIMIT 1", conn);
        cmd.Parameters.AddWithValue("identifier", NpgsqlDbType.Varchar, identifier.Trim());
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return (null, null);
        return (reader.IsDBNull(0) ? null : reader.GetString(0), reader.IsDBNull(1) ? null : reader.GetString(1));
    }

    private static bool TryVerifyLegacyPassword(string password, string storedHash, out string? upgradedHash)
    {
        upgradedHash = null;
        var isSha256Match = IsSha256Hex(storedHash) && string.Equals(ComputeSha256Hex(password), storedHash, StringComparison.OrdinalIgnoreCase);
        if (!isSha256Match && !string.Equals(password, storedHash, StringComparison.Ordinal)) return false;
        upgradedHash = BCrypt.Net.BCrypt.HashPassword(password); return true;
    }

    private bool IsValidBcryptPassword(string password, string? storedHash, string email)
    {
        if (string.IsNullOrWhiteSpace(storedHash)) { BCrypt.Net.BCrypt.Verify(password, BCrypt.Net.BCrypt.HashPassword("dummy_password")); return false; }
        if (!storedHash.StartsWith("$2", StringComparison.Ordinal)) return false;
        try { return BCrypt.Net.BCrypt.Verify(password, storedHash); } catch { return false; }
    }

    private static bool IsSha256Hex(string v) => v.Length == 64 && v.All(Uri.IsHexDigit);
    private static string ComputeSha256Hex(string v) { var b = SHA256.HashData(Encoding.UTF8.GetBytes(v)); var s = new StringBuilder(b.Length * 2); foreach (var item in b) s.Append(item.ToString("x2")); return s.ToString(); }

    private static string? ValidateVendorRegistration(RegisterVendorRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@')) return "A valid vendor email address is required.";
        if (string.IsNullOrWhiteSpace(request.CompanyName)) return "Company name is required.";
        if (string.IsNullOrWhiteSpace(request.PhoneNumber) || !PhoneNumberPattern.IsMatch(request.PhoneNumber.Trim())) return "Phone number must be 7-20 characters.";
        return ValidateVendorPassword(request.Password);
    }

    private static string? ValidateVendorPassword(string? password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < VendorPasswordMinLength) return $"Password must be at least {VendorPasswordMinLength} characters.";
        if (!HasUppercase.IsMatch(password) || !HasLowercase.IsMatch(password)) return "Password must include uppercase and lowercase.";
        if (!HasDigit.IsMatch(password)) return "Password must include a number.";
        if (!HasSymbol.IsMatch(password)) return "Password must include a special character.";
        return null;
    }

    private static string? ValidateVendorProfileUpdate(UpdateVendorProfileRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.Email) && !request.Email.Contains('@')) return "A valid vendor email address is required.";
        if (!string.IsNullOrWhiteSpace(request.PhoneNumber) && !PhoneNumberPattern.IsMatch(request.PhoneNumber.Trim())) return "Phone number must be 7-20 characters.";
        return null;
    }

    private static async Task UpgradeVendorPasswordHashAsync(NpgsqlConnection conn, string email, string upgradedHash, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("UPDATE identity.vendors SET password_hash = @p_password_hash WHERE lower(email) = lower(@p_email)", conn);
        cmd.Parameters.AddWithValue("p_email", email); cmd.Parameters.AddWithValue("p_password_hash", upgradedHash);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Data;
using System.Text;
using System.Text.RegularExpressions;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.VendorSourcing.DTOs;

namespace eProcurement.Modules.VendorSourcing.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class VendorController : ControllerBase
    {
        private const int VendorPasswordMinLength = 8;
        private static readonly Regex HasUppercase = new("[A-Z]", RegexOptions.Compiled);
        private static readonly Regex HasLowercase = new("[a-z]", RegexOptions.Compiled);
        private static readonly Regex HasDigit = new("[0-9]", RegexOptions.Compiled);
        private static readonly Regex HasSymbol = new("[^a-zA-Z0-9]", RegexOptions.Compiled);
        private static readonly Regex PhoneNumberPattern = new(@"^\+?[0-9 ()-]{7,20}$", RegexOptions.Compiled);
        private readonly IConfiguration _config;
        private readonly ILogger<VendorController> _logger;

        public VendorController(IConfiguration config, ILogger<VendorController> logger)
        {
            _config = config;
            _logger = logger;
        }

        private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterVendorRequest request, CancellationToken ct)
        {
            var connectionString = GetConnectionString();
            if (string.IsNullOrWhiteSpace(connectionString)) return Problem("DB configuration missing.");

            var validationError = ValidateVendorRegistration(request);
            if (validationError is not null)
            {
                return BadRequest(new { message = validationError });
            }

            try
            {
                var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

                await using var conn = new NpgsqlConnection(connectionString);
                await conn.OpenAsync(ct);
                await using var tx = await conn.BeginTransactionAsync(ct);
                await using var cmd = new NpgsqlCommand("identity.register_vendor_sp", conn, tx)
                {
                    CommandType = CommandType.StoredProcedure
                };

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
                await tx.CommitAsync(ct);

                var result = results.FirstOrDefault();
                if (result is null || result.VendorId == Guid.Empty)
                {
                    return Problem("Registration failed.");
                }

                return CreatedAtAction(nameof(GetProfile), new { vendorId = result.VendorId }, result);
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                var message = ex.ConstraintName switch
                {
                    "vendors_registration_number_key" => "Registration number already exists.",
                    "vendors_tax_id_key" => "Tax ID already exists.",
                    "vendors_email_key" => "Email already exists.",
                    _ => "Vendor already exists."
                };
                _logger.LogWarning(ex, "Vendor registration conflict.");
                return Conflict(new { message });
            }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] VendorLoginRequest request, CancellationToken ct)
        {
            var connectionString = GetConnectionString();
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            var credentials = await ResolveVendorCredentialsAsync(conn, request.Email, ct);
            var resolvedEmail = credentials.Email;
            var verifiedHash = await ResolveVerifiedVendorPasswordHashAsync(
                conn,
                request.Email,
                request.Password,
                credentials,
                ct);

            if (string.IsNullOrWhiteSpace(verifiedHash))
            {
                _logger.LogWarning("Invalid vendor credentials for {Email}", request.Email);
                return Unauthorized(new { message = "Invalid credentials." });
            }

            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("identity.login_vendor_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, resolvedEmail ?? request.Email);
            cmd.Parameters.AddWithValue("p_password_hash", NpgsqlDbType.Varchar, verifiedHash);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapVendorLoginResult, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            if (result is null || result.VendorId is null)
            {
                return Unauthorized(new
                {
                    message = string.IsNullOrWhiteSpace(result?.ErrorMessage) ? "Login failed." : result.ErrorMessage
                });
            }

            return Ok(result);
        }

        [Authorize]
        [HttpGet("{vendorId:guid}")]
        public async Task<IActionResult> GetProfile(Guid vendorId, CancellationToken ct)
        {
            if (!IsAuthorizedVendor(vendorId))
            {
                return Forbid();
            }

            var connectionString = GetConnectionString();
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("identity.get_vendor_profile_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, vendorId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapVendorProfile, ct);
            var result = results.FirstOrDefault();
            if (result is null)
            {
                return NotFound();
            }

            await tx.CommitAsync(ct);
            return Ok(result);
        }

        [Authorize]
        [HttpPut("{vendorId:guid}")]
        public async Task<IActionResult> UpdateProfile(Guid vendorId, [FromBody] UpdateVendorProfileRequest request, CancellationToken ct)
        {
            if (!IsAuthorizedVendor(vendorId))
            {
                return Forbid();
            }

            var connectionString = GetConnectionString();
            if (string.IsNullOrWhiteSpace(connectionString)) return Problem("DB configuration missing.");

            var validationError = ValidateVendorProfileUpdate(request);
            if (validationError is not null)
            {
                return BadRequest(new { message = validationError });
            }

            try
            {
                await using var conn = new NpgsqlConnection(connectionString);
                await conn.OpenAsync(ct);
                await using var tx = await conn.BeginTransactionAsync(ct);
                await using var cmd = new NpgsqlCommand("identity.update_vendor_profile_sp", conn, tx)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, vendorId);
                cmd.Parameters.AddWithValue("p_company_name", NpgsqlDbType.Varchar, (object?)request.CompanyName ?? DBNull.Value);
                cmd.Parameters.AddWithValue("p_company_address", NpgsqlDbType.Text, (object?)request.CompanyAddress ?? DBNull.Value);
                cmd.Parameters.AddWithValue("p_contact_person", NpgsqlDbType.Varchar, (object?)request.ContactPerson ?? DBNull.Value);
                cmd.Parameters.AddWithValue("p_phone_number", NpgsqlDbType.Varchar, (object?)request.PhoneNumber ?? DBNull.Value);
                cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, (object?)request.Email ?? DBNull.Value);
                cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

                var results = await ExecuteRefcursorAsync(cmd, MapVendorProfile, ct);
                await tx.CommitAsync(ct);

                var result = results.FirstOrDefault();
                if (result is null)
                {
                    return NotFound();
                }

                return Ok(result);
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                var message = ex.ConstraintName switch
                {
                    "vendors_email_key" => "Email already exists.",
                    _ => "Update conflict."
                };
                _logger.LogWarning(ex, "Vendor profile update conflict.");
                return Conflict(new { message });
            }
        }

        [HttpGet("availability")]
        public async Task<IActionResult> CheckAvailability(
            [FromQuery] string? email,
            [FromQuery] string? registrationNumber,
            [FromQuery] string? taxId,
            CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(email) &&
                string.IsNullOrWhiteSpace(registrationNumber) &&
                string.IsNullOrWhiteSpace(taxId))
            {
                return BadRequest(new { message = "Provide email, registrationNumber, or taxId to check availability." });
            }

            var connectionString = GetConnectionString();
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            const string sql = @"
SELECT
    CASE WHEN @p_email IS NULL THEN FALSE ELSE EXISTS (
        SELECT 1 FROM identity.vendors WHERE email = @p_email
    ) END AS email_exists,
    CASE WHEN @p_registration IS NULL THEN FALSE ELSE EXISTS (
        SELECT 1 FROM identity.vendors WHERE registration_number = @p_registration
    ) END AS registration_exists,
    CASE WHEN @p_tax IS NULL THEN FALSE ELSE EXISTS (
        SELECT 1 FROM identity.vendors WHERE tax_id = @p_tax
    ) END AS tax_exists;";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, (object?)email ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_registration", NpgsqlDbType.Varchar, (object?)registrationNumber ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_tax", NpgsqlDbType.Varchar, (object?)taxId ?? DBNull.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return Ok(new { emailAvailable = true, registrationAvailable = true, taxAvailable = true });
            }

            var emailExists = reader.GetBoolean(reader.GetOrdinal("email_exists"));
            var registrationExists = reader.GetBoolean(reader.GetOrdinal("registration_exists"));
            var taxExists = reader.GetBoolean(reader.GetOrdinal("tax_exists"));

            return Ok(new
            {
                emailAvailable = !emailExists,
                registrationAvailable = !registrationExists,
                taxAvailable = !taxExists
            });
        }

        // Helper methods for refcursor processing
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

        private static VendorRegistrationResult MapVendorRegistrationResult(NpgsqlDataReader r)
        {
            return new VendorRegistrationResult(
                r.GetGuid(r.GetOrdinal("vendor_id")),
                r.GetString(r.GetOrdinal("company_name")),
                r.GetString(r.GetOrdinal("email")));
        }

        private static VendorLoginResult MapVendorLoginResult(NpgsqlDataReader r)
        {
            return new VendorLoginResult(
                GetNullableGuid(r, "vendor_id"),
                GetNullableString(r, "company_name"),
                GetNullableString(r, "email"),
                GetNullableString(r, "vendor_status"),
                GetNullableString(r, "error_message"));
        }

        private static VendorProfile MapVendorProfile(NpgsqlDataReader r)
        {
            return new VendorProfile(
                r.GetGuid(r.GetOrdinal("vendor_id")),
                r.GetString(r.GetOrdinal("company_name")),
                r.GetString(r.GetOrdinal("registration_number")),
                r.GetString(r.GetOrdinal("tax_id")),
                r.GetString(r.GetOrdinal("company_address")),
                r.GetString(r.GetOrdinal("contact_person")),
                GetNullableString(r, "phone_number"),
                r.GetString(r.GetOrdinal("email")),
                GetNullableDateTime(r, "registration_date"),
                GetNullableDateTime(r, "last_login"),
                r.GetString(r.GetOrdinal("vendor_status")));
        }

        private static string? GetNullableString(NpgsqlDataReader r, string n)
        {
            var ordinal = r.GetOrdinal(n);
            return r.IsDBNull(ordinal) ? null : r.GetString(ordinal);
        }

        private static Guid? GetNullableGuid(NpgsqlDataReader r, string n)
        {
            var ordinal = r.GetOrdinal(n);
            return r.IsDBNull(ordinal) ? null : r.GetGuid(ordinal);
        }

        private static DateTime? GetNullableDateTime(NpgsqlDataReader r, string n)
        {
            var ordinal = r.GetOrdinal(n);
            return r.IsDBNull(ordinal) ? null : r.GetDateTime(ordinal);
        }

        private bool IsAuthorizedVendor(Guid vendorId)
        {
            var subject = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(subject, out var tokenVendorId))
            {
                return false;
            }

            var role = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
            return tokenVendorId == vendorId &&
                   string.Equals(role, "vendor", StringComparison.OrdinalIgnoreCase);
        }

        private bool IsValidBcryptPassword(string password, string? storedHash, string email)
        {
            if (string.IsNullOrWhiteSpace(storedHash))
            {
                BCrypt.Net.BCrypt.Verify(password, BCrypt.Net.BCrypt.HashPassword("dummy_password"));
                return false;
            }

            if (!LooksLikeBcryptHash(storedHash))
            {
                return false;
            }

            try
            {
                return BCrypt.Net.BCrypt.Verify(password, storedHash);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Invalid BCrypt hash format for {Email}.", email);
                return false;
            }
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
            _logger.LogInformation("Upgraded legacy password hash for vendor {Email}", credentials.Email);
            return upgradedHash;
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

        private static string? ValidateVendorRegistration(RegisterVendorRequest request)
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

            return ValidateVendorPassword(request.Password);
        }

        private static string? ValidateVendorPassword(string? password)
        {
            if (string.IsNullOrWhiteSpace(password))
            {
                return "Password is required.";
            }

            if (password.Length < VendorPasswordMinLength)
            {
                return $"Password must be at least {VendorPasswordMinLength} characters.";
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

        private static string? ValidateVendorProfileUpdate(UpdateVendorProfileRequest request)
        {
            if (!string.IsNullOrWhiteSpace(request.Email) &&
                !request.Email.Contains('@', StringComparison.Ordinal))
            {
                return "A valid vendor email address is required.";
            }

            if (!string.IsNullOrWhiteSpace(request.PhoneNumber) &&
                !PhoneNumberPattern.IsMatch(request.PhoneNumber.Trim()))
            {
                return "Phone number must be 7-20 characters and may include digits, spaces, parentheses, hyphen, or leading +.";
            }

            return null;
        }

        private static async Task UpgradeVendorPasswordHashAsync(
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
    }
}

using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using eProcurement.Shared.Configurations;
using eProcurement.Modules.Identity.DTOs;
using eProcurement.Modules.Identity.Services;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Shared.Controllers;

namespace eProcurement.Modules.Identity.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : BaseModuleController
    {
        private const int InternalPasswordMinLength = 8;
        private static readonly Regex HasUppercase = new("[A-Z]", RegexOptions.Compiled);
        private static readonly Regex HasLowercase = new("[a-z]", RegexOptions.Compiled);
        private static readonly Regex HasDigit = new("[0-9]", RegexOptions.Compiled);
        private static readonly Regex HasSymbol = new("[^a-zA-Z0-9]", RegexOptions.Compiled);
        private static readonly Regex UsernamePattern = new("^[A-Za-z0-9._-]{3,100}$", RegexOptions.Compiled);
        private static readonly Regex NamePattern = new("^[A-Za-z][A-Za-z' -]{0,99}$", RegexOptions.Compiled);
        private static readonly Regex ServiceNumberPattern = new("^[A-Za-z0-9/-]{3,100}$", RegexOptions.Compiled);
        private static readonly Regex PhoneNumberPattern = new(@"^\+?[0-9 ()-]{7,20}$", RegexOptions.Compiled);
        private readonly WorkflowActionGrantService _workflowActionGrantService;

        public AuthController(
            IConfiguration config,
            ILogger<AuthController> logger,
            WorkflowActionGrantService workflowActionGrantService)
            : base(config, logger)
        {
            _workflowActionGrantService = workflowActionGrantService;
        }

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

                // Step 2: Call the existing SP with the stored hash to complete login logic
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
                SetAuthCookie(token);
                return Ok(new AuthResponse(token, result.Email ?? resolvedEmail ?? request.Email, "Success"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error during login for {Email}", request.Email);
                return Problem("Internal server error during login.");
            }
        }

        [Authorize]
        [HttpGet("me")]
        public IActionResult Me()
        {
            var userId = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            var email = User.FindFirst(JwtRegisteredClaimNames.Email)?.Value;
            var role = User.FindFirst("role")?.Value;

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            return Ok(new
            {
                UserId = userId,
                Email = email,
                Role = role
            });
        }

        [HttpPost("logout")]
        public IActionResult Logout()
        {
            Response.Cookies.Delete("vendorAuthToken");
            return Ok(new { message = "Logged out successfully" });
        }

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

                // Call the stored procedure regardless of initial password validity to handle lockout logic
                await using var tx = await conn.BeginTransactionAsync(ct);
                await using var cmd = new NpgsqlCommand("identity.internal_login_sp", conn, tx)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, resolvedEmail ?? request.Email);
                // Pass the actual stored hash if password is valid, otherwise pass a dummy value to trigger failure logic in SP
                cmd.Parameters.AddWithValue("p_password_hash", NpgsqlDbType.Varchar, isPasswordValid ? verifiedPasswordHash! : "INVALID_HASH_TO_TRIGGER_SP_FAILURE");
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
                var token = GenerateToken(result.InternalUserId.Value, result.Email ?? resolvedEmail ?? request.Email, role);
                SetAuthCookie(token);
                return Ok(new AuthResponse(token, result.Email ?? resolvedEmail ?? request.Email, result.Status ?? "Success", role));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error during internal login for {Email}", request.Email);
                return Problem("Internal server error during login.");
            }
        }

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
                if (result is null) return Problem("Failed to register vendor.");

                var token = GenerateToken(result.VendorId, result.Email, "vendor");
                SetAuthCookie(token);
                return Ok(new AuthResponse(token, result.Email, "Success"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error registering vendor {Email}", request.Email);
                return Problem("Internal server error during registration.");
            }
        }

        private void SetAuthCookie(string token)
        {
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = true, // Set to true in production
                SameSite = SameSiteMode.Strict,
                Expires = DateTime.UtcNow.AddHours(24)
            };
            Response.Cookies.Append("vendorAuthToken", token, cookieOptions);
        }


        [HttpPost("internal/register")]
        public async Task<IActionResult> InternalRegister([FromBody] InternalUserRegistrationRequest request, CancellationToken ct)
        {
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
                if (result is null) return Problem("Failed to register internal user.");

                var token = GenerateToken(result.InternalUserId, result.Email, result.Role);
                return Ok(new AuthResponse(token, result.Email, "Success", result.Role));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error registering internal user {Email}", request.Email);
                return Problem("Internal server error during internal registration.");
            }
        }

        [HttpPost("roles")]
        public async Task<IActionResult> CreateRole([FromBody] CreateRoleRequest request, CancellationToken ct)
        {
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

        [HttpGet("roles")]
        public async Task<IActionResult> GetRoles(CancellationToken ct)
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
        [HttpGet("internal/modules")]
        public async Task<IActionResult> GetInternalModules(CancellationToken ct)
        {
            var role = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
            if (string.IsNullOrWhiteSpace(role))
            {
                return Unauthorized(new { message = "Authenticated role is missing." });
            }

            var connectionString = GetConnectionString();
            var workflowActions = string.IsNullOrWhiteSpace(connectionString)
                ? Array.Empty<string>()
                : await _workflowActionGrantService.GetRoleModuleActionsAsync(connectionString, role, ct);

            return Ok(InternalModuleCatalog.GetModulesForRole(role, workflowActions));
        }

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

        [HttpPut("internal/users/role")]
        public async Task<IActionResult> UpdateInternalUserRole([FromBody] UpdateInternalUserRoleRequest request, CancellationToken ct)
        {
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

        private bool IsValidBcryptPassword(string passwordWithPepper, string? storedHash, string email)
        {
            if (string.IsNullOrWhiteSpace(storedHash))
            {
                // Mitigate timing attacks by doing a dummy check
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

        private string GenerateToken(Guid userId, string email, string role)
        {
            if (string.IsNullOrWhiteSpace(role))
            {
                throw new InvalidOperationException("A role is required to issue an authentication token.");
            }

            var jwtSettings = new JwtSettings();
            Config.GetSection("Jwt").Bind(jwtSettings);

            var key = string.IsNullOrEmpty(jwtSettings.Key) ? "YourSuperSecretKeyWithAtLeast32Characters!" : jwtSettings.Key;
            var issuer = string.IsNullOrEmpty(jwtSettings.Issuer) ? "nis-eproc-identity" : jwtSettings.Issuer;
            var audience = string.IsNullOrEmpty(jwtSettings.Audience) ? "nis-eproc-clients" : jwtSettings.Audience;
            var durationMinutes = jwtSettings.DurationInMinutes <= 0 ? 1440 : jwtSettings.DurationInMinutes;

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, email),
                new Claim("role", role)
            };

            var creds = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256);
            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(durationMinutes),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
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

        private static InternalLoginResult MapInternalLoginResult(NpgsqlDataReader r)
        {
            return new InternalLoginResult(
                GetNullableGuid(r, "internal_user_id"),
                GetNullableString(r, "email"),
                GetNullableString(r, "role"),
                GetNullableString(r, "status"),
                GetNullableString(r, "error_message"));
        }

        private static InternalUserRegistrationResult MapInternalUserRegistrationResult(NpgsqlDataReader r)
        {
            return new InternalUserRegistrationResult(
                r.GetGuid(r.GetOrdinal("internal_user_id")),
                r.GetString(r.GetOrdinal("email")),
                r.GetString(r.GetOrdinal("role")),
                GetNullableGuid(r, "unit_id"),
                GetNullableString(r, "unit_name"));
        }

        private static InternalUserRoleResult MapInternalUserRoleResult(NpgsqlDataReader r)
        {
            return new InternalUserRoleResult(
                r.GetGuid(r.GetOrdinal("internal_user_id")),
                r.GetString(r.GetOrdinal("email")),
                r.GetString(r.GetOrdinal("role")));
        }

        private static RoleResult MapRoleResult(NpgsqlDataReader r)
        {
            return new RoleResult(
                r.GetGuid(r.GetOrdinal("role_id")),
                r.GetString(r.GetOrdinal("role_name")),
                GetNullableString(r, "description"),
                r.GetBoolean(r.GetOrdinal("is_active")));
        }

        private static InternalOrganizationalUnitResult MapInternalOrganizationalUnitResult(NpgsqlDataReader r)
        {
            return new InternalOrganizationalUnitResult(
                r.GetGuid(r.GetOrdinal("unit_id")),
                r.GetString(r.GetOrdinal("unit_name")),
                r.GetString(r.GetOrdinal("unit_code")),
                r.GetString(r.GetOrdinal("unit_type")),
                GetNullableGuid(r, "parent_unit_id"),
                GetNullableString(r, "parent_unit_name"),
                r.GetInt32(r.GetOrdinal("sort_order")),
                r.GetBoolean(r.GetOrdinal("is_assignable")));
        }
    }
}

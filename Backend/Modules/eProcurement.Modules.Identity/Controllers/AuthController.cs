using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using eProcurement.Shared.Configurations;
using eProcurement.Modules.Identity.DTOs;
using eProcurement.Modules.Identity.Services;
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
        public AuthController(IConfiguration config, ILogger<AuthController> logger)
            : base(config, logger)
        {
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

                // Step 1: Fetch the stored hash for BCrypt verification
                string? storedHash = null;
                await using (var cmdHash = new NpgsqlCommand("SELECT password_hash FROM identity.vendors WHERE email = @email", conn))
                {
                    cmdHash.Parameters.AddWithValue("email", request.Email);
                    storedHash = (string?)await cmdHash.ExecuteScalarAsync(ct);
                }

                if (!IsValidBcryptPassword(request.Password, storedHash, request.Email))
                {
                    Logger.LogWarning("Invalid vendor credentials for {Email}", request.Email);
                    return Unauthorized(new { message = "Invalid credentials." });
                }

                var verifiedHash = storedHash ?? throw new InvalidOperationException("Stored password hash missing after successful verification.");

                // Step 2: Call the existing SP with the stored hash to complete login logic
                await using var tx = await conn.BeginTransactionAsync(ct);
                await using var cmd = new NpgsqlCommand("identity.login_vendor_sp", conn, tx)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, request.Email);
                cmd.Parameters.AddWithValue("p_password_hash", NpgsqlDbType.Varchar, verifiedHash);
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

                var token = GenerateToken(result.VendorId.Value, result.Email ?? request.Email, "vendor");
                return Ok(new AuthResponse(token, result.Email ?? request.Email, "Success"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error during login for {Email}", request.Email);
                return Problem("Internal server error during login.");
            }
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

                string? storedPasswordHash = null;

                // Step 1: Fetch the stored hash for BCrypt verification
                await using (var cmdFetchHash = new NpgsqlCommand("SELECT password_hash FROM identity.internal_users WHERE email = @email", conn))
                {
                    cmdFetchHash.Parameters.AddWithValue("email", request.Email);
                    storedPasswordHash = (string?)await cmdFetchHash.ExecuteScalarAsync(ct);
                }

                // Assume invalid credentials if user not found or password hash is empty
                var isPasswordValid = IsValidBcryptPassword(request.Password, storedPasswordHash, request.Email);

                // Call the stored procedure regardless of initial password validity to handle lockout logic
                await using var tx = await conn.BeginTransactionAsync(ct);
                await using var cmd = new NpgsqlCommand("identity.internal_login_sp", conn, tx)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, request.Email);
                // Pass the actual stored hash if password is valid, otherwise pass a dummy value to trigger failure logic in SP
                cmd.Parameters.AddWithValue("p_password_hash", NpgsqlDbType.Varchar, isPasswordValid ? storedPasswordHash! : "INVALID_HASH_TO_TRIGGER_SP_FAILURE");
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
                var token = GenerateToken(result.InternalUserId.Value, result.Email ?? request.Email, role);
                return Ok(new AuthResponse(token, result.Email ?? request.Email, "Success"));
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
                string.IsNullOrWhiteSpace(request.ContactPerson))
            {
                return BadRequest(new
                {
                    message = "Registration number, tax ID, company address, and contact person are required."
                });
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
                cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, request.Email);
                cmd.Parameters.AddWithValue("p_password_hash", NpgsqlDbType.Varchar, hash);
                cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

                var results = await ExecuteRefcursorAsync(cmd, MapVendorRegistrationResult, ct);
                await tx.CommitAsync(ct);

                var result = results.FirstOrDefault();
                if (result is null) return Problem("Failed to register vendor.");

                var token = GenerateToken(result.VendorId, result.Email, "vendor");
                return Ok(new AuthResponse(token, result.Email, "Success"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error registering vendor {Email}", request.Email);
                return Problem("Internal server error during registration.");
            }
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

                cmd.Parameters.AddWithValue("p_email", NpgsqlDbType.Varchar, request.Email);
                cmd.Parameters.AddWithValue("p_password_hash", NpgsqlDbType.Varchar, hash);
                cmd.Parameters.AddWithValue("p_role", NpgsqlDbType.Varchar, request.Role ?? "Internal");
                cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

                var results = await ExecuteRefcursorAsync(cmd, MapInternalUserRegistrationResult, ct);
                await tx.CommitAsync(ct);

                var result = results.FirstOrDefault();
                if (result is null) return Problem("Failed to register internal user.");

                var token = GenerateToken(result.InternalUserId, result.Email, result.Role);
                return Ok(new AuthResponse(token, result.Email, "Success"));
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
        public IActionResult GetInternalModules()
        {
            var role = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
            if (string.IsNullOrWhiteSpace(role))
            {
                return Unauthorized(new { message = "Authenticated role is missing." });
            }

            return Ok(InternalModuleCatalog.GetModulesForRole(role));
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
                r.GetString(r.GetOrdinal("role")));
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
    }
}

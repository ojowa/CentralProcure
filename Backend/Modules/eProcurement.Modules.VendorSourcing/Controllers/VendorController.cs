using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Npgsql;
using eProcurement.Modules.VendorSourcing.DTOs;
using eProcurement.Modules.VendorSourcing.Services;

namespace eProcurement.Modules.VendorSourcing.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class VendorController : ControllerBase
    {
        private readonly ILogger<VendorController> _logger;
        private readonly IVendorService _vendorService;

        public VendorController(ILogger<VendorController> logger, IVendorService vendorService)
        {
            _logger = logger;
            _vendorService = vendorService;
        }

        [AllowAnonymous]
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterVendorRequest request, CancellationToken ct)
        {
            try
            {
                var result = await _vendorService.RegisterAsync(request, ct);
                return CreatedAtAction(nameof(GetProfile), new { vendorId = result.VendorId }, result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (PostgresException ex) when (ex.SqlState == "23505")
            {
                var message = ex.ConstraintName switch
                {
                    "vendors_registration_number_key" => "Registration number already exists.",
                    "vendors_tax_id_key" => "Tax ID already exists.",
                    "vendors_email_key" => "Email already exists.",
                    _ => "Vendor already exists."
                };
                return Conflict(new { message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Vendor registration failed.");
                return Problem("Registration failed.");
            }
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] VendorLoginRequest request, CancellationToken ct)
        {
            try
            {
                var result = await _vendorService.LoginAsync(request, ct);
                if (result.VendorId is null)
                {
                    return Unauthorized(new { message = result.ErrorMessage ?? "Login failed." });
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Vendor login failed.");
                return Unauthorized(new { message = "Login failed." });
            }
        }

        [Authorize]
        [HttpGet("{vendorId:guid}")]
        public async Task<IActionResult> GetProfile(Guid vendorId, CancellationToken ct)
        {
            if (!IsAuthorizedVendor(vendorId)) return Forbid();

            try
            {
                var result = await _vendorService.GetProfileAsync(vendorId, ct);
                return result is null ? NotFound() : Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting vendor profile.");
                return Problem("Internal server error.");
            }
        }

        [Authorize]
        [HttpPut("{vendorId:guid}")]
        public async Task<IActionResult> UpdateProfile(Guid vendorId, [FromBody] UpdateVendorProfileRequest request, CancellationToken ct)
        {
            if (!IsAuthorizedVendor(vendorId)) return Forbid();

            try
            {
                var result = await _vendorService.UpdateProfileAsync(vendorId, request, ct);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }
            catch (PostgresException ex) when (ex.SqlState == "23505")
            {
                return Conflict(new { message = ex.ConstraintName == "vendors_email_key" ? "Email already exists." : "Update conflict." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Vendor profile update failed.");
                return Problem("Update failed.");
            }
        }

        [AllowAnonymous]
        [HttpGet("availability")]
        public async Task<IActionResult> CheckAvailability(
            [FromQuery] string? email,
            [FromQuery] string? registrationNumber,
            [FromQuery] string? taxId,
            CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(email) && string.IsNullOrWhiteSpace(registrationNumber) && string.IsNullOrWhiteSpace(taxId))
            {
                return BadRequest(new { message = "Provide email, registrationNumber, or taxId." });
            }

            try
            {
                var (emailAvail, regAvail, taxAvail) = await _vendorService.CheckAvailabilityAsync(email, registrationNumber, taxId, ct);
                return Ok(new { emailAvailable = emailAvail, registrationAvailable = regAvail, taxAvailable = taxAvail });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking availability.");
                return Problem("Internal server error.");
            }
        }

        private bool IsAuthorizedVendor(Guid vendorId)
        {
            var subject = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(subject, out var tokenVendorId)) return false;
            var role = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
            return tokenVendorId == vendorId && string.Equals(role, "vendor", StringComparison.OrdinalIgnoreCase);
        }
    }
}

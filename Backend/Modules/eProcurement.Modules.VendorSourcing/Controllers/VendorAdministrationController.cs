using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using eProcurement.Modules.VendorSourcing.DTOs;
using eProcurement.Modules.VendorSourcing.Services;

namespace eProcurement.Modules.VendorSourcing.Controllers;

[ApiController]
[Authorize]
[Route("api/admin/vendors")]
public class VendorAdministrationController : ControllerBase
{
    private readonly ILogger<VendorAdministrationController> _logger;
    private readonly IVendorAdministrationService _adminService;
    private readonly IWebHostEnvironment _environment;

    private static readonly HashSet<string> AllowedRoles = new(StringComparer.OrdinalIgnoreCase) { "admin", "ict_admin" };
    private static readonly Dictionary<string, string> RoleAliases = new(StringComparer.OrdinalIgnoreCase) { ["system_administrator"] = "ict_admin" };

    public VendorAdministrationController(
        ILogger<VendorAdministrationController> logger,
        IVendorAdministrationService adminService,
        IWebHostEnvironment environment)
    {
        _logger = logger;
        _adminService = adminService;
        _environment = environment;
    }

    [HttpGet]
    public async Task<IActionResult> GetRegistrations([FromQuery] string? status, [FromQuery] string? query, CancellationToken ct)
    {
        if (!UserHasAnyRole(AllowedRoles)) return Forbid();
        try
        {
            return Ok(await _adminService.GetRegistrationsAsync(status, query, ct));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving vendor registrations.");
            return Problem("Internal server error.");
        }
    }

    [HttpGet("{vendorId:guid}")]
    public async Task<IActionResult> GetRegistration(Guid vendorId, CancellationToken ct)
    {
        if (!UserHasAnyRole(AllowedRoles)) return Forbid();
        try
        {
            var result = await _adminService.GetRegistrationAsync(vendorId, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving vendor detail.");
            return Problem("Internal server error.");
        }
    }

    [HttpPost("{vendorId:guid}/decision")]
    public async Task<IActionResult> DecideRegistration(Guid vendorId, [FromBody] VendorApprovalDecisionRequest request, CancellationToken ct)
    {
        if (!UserHasAnyRole(AllowedRoles)) return Forbid();
        try
        {
            var result = await _adminService.DecideRegistrationAsync(vendorId, request, GetDecisionActor(), ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deciding vendor registration.");
            return Problem("Update failed.");
        }
    }

    [HttpGet("compliance/{documentId:guid}/file")]
    public async Task<IActionResult> DownloadComplianceFile(Guid documentId, CancellationToken ct)
    {
        if (!UserHasAnyRole(AllowedRoles)) return Forbid();
        try
        {
            var url = await _adminService.GetComplianceDocumentUrlAsync(documentId, ct);
            if (string.IsNullOrWhiteSpace(url)) return NotFound();
            var path = Path.Combine(_environment.ContentRootPath, url.Replace("/", Path.DirectorySeparatorChar.ToString()));
            if (!System.IO.File.Exists(path)) return NotFound();
            return PhysicalFile(path, "application/octet-stream", Path.GetFileName(path), enableRangeProcessing: true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading compliance document.");
            return Problem("Internal server error.");
        }
    }

    private bool UserHasAnyRole(IReadOnlySet<string> allowed)
    {
        var raw = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
        if (string.IsNullOrWhiteSpace(raw)) return false;
        var normalized = System.Text.RegularExpressions.Regex.Replace(raw.Trim().Replace("-", "_").Replace(" ", "_"), "([a-z0-9])([A-Z])", "$1_$2").ToLowerInvariant();
        var mapped = RoleAliases.TryGetValue(normalized, out var m) ? m : normalized;
        return allowed.Contains(mapped);
    }

    private string GetDecisionActor() => User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email") ?? User.FindFirstValue("sub") ?? "system";
}

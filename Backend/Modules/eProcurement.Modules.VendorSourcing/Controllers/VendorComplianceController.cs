using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using eProcurement.Modules.VendorSourcing.DTOs;
using eProcurement.Modules.VendorSourcing.Services;

namespace eProcurement.Modules.VendorSourcing.Controllers;

[ApiController]
[Route("api/Vendor/compliance")]
public class VendorComplianceController : ControllerBase
{
    private readonly ILogger<VendorComplianceController> _logger;
    private readonly IVendorComplianceService _complianceService;
    private readonly IWebHostEnvironment _environment;

    public VendorComplianceController(
        ILogger<VendorComplianceController> logger,
        IVendorComplianceService complianceService,
        IWebHostEnvironment environment)
    {
        _logger = logger;
        _complianceService = complianceService;
        _environment = environment;
    }

    [Authorize]
    [HttpGet("requirements")]
    public IActionResult GetRequirements()
    {
        if (!IsVendorRole()) return Forbid();
        return Ok(_complianceService.GetRequirements());
    }

    [Authorize]
    [HttpGet("checklist")]
    public IActionResult DownloadChecklist()
    {
        if (!IsVendorRole()) return Forbid();
        var reqs = _complianceService.GetRequirements();
        var lines = new List<string> { "NIS Vendor Compliance Checklist", "===============================", $"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC", string.Empty };
        foreach (var req in reqs)
        {
            lines.Add($"- {req.Name} ({(req.Required ? "Required" : "Optional")}, {req.Frequency})");
            lines.Add($"  {req.Description}");
        }
        return File(System.Text.Encoding.UTF8.GetBytes(string.Join(Environment.NewLine, lines)), "text/plain", "compliance-checklist.txt");
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetDocuments(CancellationToken ct)
    {
        var vendorId = GetVendorIdFromClaims();
        if (!vendorId.HasValue || !IsVendorRole()) return Forbid();
        try
        {
            return Ok(await _complianceService.GetDocumentsAsync(vendorId.Value, ct));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving compliance documents.");
            return Problem("Internal server error.");
        }
    }

    [Authorize]
    [HttpPost("upload")]
    public async Task<IActionResult> Upload([FromForm] ComplianceUploadForm request, CancellationToken ct)
    {
        var vendorId = GetVendorIdFromClaims();
        if (!vendorId.HasValue || !IsVendorRole()) return Forbid();
        if (request.File is null || request.File.Length == 0) return BadRequest("File is required.");
        if (string.IsNullOrWhiteSpace(request.DocumentType)) return BadRequest("DocumentType is required.");

        try
        {
            var result = await _complianceService.UploadDocumentAsync(vendorId.Value, request.DocumentType, request.ExpiryDate, request.File, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading compliance document.");
            return Problem("Upload failed.");
        }
    }

    [Authorize]
    [HttpGet("{documentId:guid}/file")]
    public async Task<IActionResult> Download(Guid documentId, CancellationToken ct)
    {
        var vendorId = GetVendorIdFromClaims();
        if (!vendorId.HasValue || !IsVendorRole()) return Forbid();
        try
        {
            var url = await _complianceService.GetDocumentUrlAsync(vendorId.Value, documentId, ct);
            if (string.IsNullOrWhiteSpace(url)) return NotFound();
            var path = Path.Combine(_environment.ContentRootPath, url.Replace("/", Path.DirectorySeparatorChar.ToString()));
            if (!System.IO.File.Exists(path)) return NotFound();
            return PhysicalFile(path, "application/octet-stream", Path.GetFileName(path), enableRangeProcessing: true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading compliance document.");
            return Problem("Download failed.");
        }
    }

    [Authorize]
    [HttpGet("history/{documentType}")]
    public async Task<IActionResult> GetHistory(string documentType, CancellationToken ct)
    {
        var vendorId = GetVendorIdFromClaims();
        if (!vendorId.HasValue || !IsVendorRole()) return Forbid();
        try
        {
            return Ok(await _complianceService.GetHistoryAsync(vendorId.Value, documentType, ct));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving history.");
            return Problem("Internal server error.");
        }
    }

    [Authorize]
    [HttpGet("history/file/{historyId:guid}")]
    public async Task<IActionResult> DownloadHistoryFile(Guid historyId, CancellationToken ct)
    {
        var vendorId = GetVendorIdFromClaims();
        if (!vendorId.HasValue || !IsVendorRole()) return Forbid();
        try
        {
            var url = await _complianceService.GetHistoryFileUrlAsync(vendorId.Value, historyId, ct);
            if (string.IsNullOrWhiteSpace(url)) return NotFound();
            var path = Path.Combine(_environment.ContentRootPath, url.Replace("/", Path.DirectorySeparatorChar.ToString()));
            if (!System.IO.File.Exists(path)) return NotFound();
            return PhysicalFile(path, "application/octet-stream", Path.GetFileName(path), enableRangeProcessing: true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading history file.");
            return Problem("Download failed.");
        }
    }

    private Guid? GetVendorIdFromClaims()
    {
        var subject = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(subject, out var vendorId) ? vendorId : null;
    }

    private bool IsVendorRole()
    {
        var role = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
        return string.Equals(role, "vendor", StringComparison.OrdinalIgnoreCase);
    }
}

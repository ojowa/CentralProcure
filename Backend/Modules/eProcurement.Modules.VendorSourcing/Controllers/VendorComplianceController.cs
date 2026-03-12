using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.VendorSourcing.Controllers;

[ApiController]
[Route("api/Vendor/compliance")]
public class VendorComplianceController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<VendorComplianceController> _logger;

    private static readonly IReadOnlyList<ComplianceRequirement> Requirements = new[]
    {
        new ComplianceRequirement(
            "cac_certificate",
            "CAC Certificate",
            true,
            "One-time",
            false,
            "Corporate Affairs Commission registration certificate."),
        new ComplianceRequirement(
            "tax_clearance",
            "Tax Clearance Certificate",
            true,
            "Annual",
            true,
            "Most recent tax clearance certificate."),
        new ComplianceRequirement(
            "pencom_certificate",
            "PENCOM Compliance Certificate",
            true,
            "Annual",
            true,
            "Pension compliance certificate (PENCOM)."),
        new ComplianceRequirement(
            "itf_certificate",
            "ITF Compliance Certificate",
            true,
            "Annual",
            true,
            "Industrial Training Fund compliance certificate."),
        new ComplianceRequirement(
            "company_profile",
            "Company Profile",
            true,
            "As needed",
            false,
            "Company overview, ownership, and experience."),
        new ComplianceRequirement(
            "bank_reference",
            "Bank Reference Letter",
            false,
            "As needed",
            true,
            "Bank reference letter or statement of good standing."),
        new ComplianceRequirement(
            "insurance_certificate",
            "Insurance Certificate",
            false,
            "Annual",
            true,
            "Valid insurance coverage certificate.")
    };

    public VendorComplianceController(IConfiguration config, IWebHostEnvironment environment, ILogger<VendorComplianceController> logger)
    {
        _config = config;
        _environment = environment;
        _logger = logger;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    private string UploadRoot => Path.Combine(_environment.ContentRootPath, "uploads", "compliance");

    [Authorize]
    [HttpGet("requirements")]
    public IActionResult GetRequirements()
    {
        if (!IsVendorRole())
        {
            return Forbid();
        }

        return Ok(Requirements);
    }

    [Authorize]
    [HttpGet("checklist")]
    public IActionResult DownloadChecklist()
    {
        if (!IsVendorRole())
        {
            return Forbid();
        }

        var lines = new List<string>
        {
            "NIS Vendor Compliance Checklist",
            "===============================",
            $"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC",
            string.Empty
        };

        foreach (var req in Requirements)
        {
            var requirement = req.Required ? "Required" : "Optional";
            lines.Add($"- {req.Name} ({requirement}, {req.Frequency})");
            lines.Add($"  {req.Description}");
        }

        var content = string.Join(Environment.NewLine, lines);
        var bytes = System.Text.Encoding.UTF8.GetBytes(content);
        return File(bytes, "text/plain", "compliance-checklist.txt");
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetDocuments(CancellationToken ct)
    {
        var vendorId = GetVendorIdFromClaims();
        if (!vendorId.HasValue || !IsVendorRole())
        {
            return Forbid();
        }

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
            await using var cmd = new NpgsqlCommand("identity.get_vendor_compliance_documents_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, vendorId.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var items = await ExecuteRefcursorAsync(cmd, MapComplianceDocument, ct);
            await tx.CommitAsync(ct);

            return Ok(items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving compliance documents for vendor {VendorId}.", vendorId);
            return Problem("Internal server error retrieving compliance documents.");
        }
    }

    [Authorize]
    [HttpPost("upload")]
    public async Task<IActionResult> Upload([FromForm] ComplianceUploadForm request, CancellationToken ct)
    {
        var vendorId = GetVendorIdFromClaims();
        if (!vendorId.HasValue || !IsVendorRole())
        {
            return Forbid();
        }

        if (request.File is null || request.File.Length == 0)
        {
            return BadRequest(new { message = "File is required." });
        }

        if (string.IsNullOrWhiteSpace(request.DocumentType))
        {
            return BadRequest(new { message = "DocumentType is required." });
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            Directory.CreateDirectory(UploadRoot);

            var safeFileName = Path.GetFileName(request.File.FileName);
            var extension = Path.GetExtension(safeFileName);
            var safeDocType = new string(request.DocumentType
                .Where(ch => char.IsLetterOrDigit(ch) || ch == '_' || ch == '-')
                .ToArray());
            if (string.IsNullOrWhiteSpace(safeDocType))
            {
                safeDocType = "document";
            }

            var fileName = $"{vendorId.Value:N}_{safeDocType}_{DateTime.UtcNow:yyyyMMddHHmmss}{extension}";
            var filePath = Path.Combine(UploadRoot, fileName);

            await using (var stream = System.IO.File.Create(filePath))
            {
                await request.File.CopyToAsync(stream, ct);
            }

            var relativePath = Path.Combine("uploads", "compliance", fileName).Replace("\\", "/");

            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("identity.upload_compliance_document_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, vendorId.Value);
            cmd.Parameters.AddWithValue("p_document_type", NpgsqlDbType.Varchar, request.DocumentType);
            cmd.Parameters.AddWithValue("p_document_url", NpgsqlDbType.Text, relativePath);
            cmd.Parameters.AddWithValue("p_expiry_date", NpgsqlDbType.Date, (object?)request.ExpiryDate ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapUploadedDocument, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            if (result is null)
            {
                return Problem("Compliance upload failed.");
            }

            var enriched = result with { ExpiryDate = request.ExpiryDate };
            return Ok(enriched);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading compliance document for vendor {VendorId}.", vendorId);
            return Problem("Internal server error uploading compliance document.");
        }
    }

    [Authorize]
    [HttpGet("{documentId:guid}/file")]
    public async Task<IActionResult> Download(Guid documentId, CancellationToken ct)
    {
        var vendorId = GetVendorIdFromClaims();
        if (!vendorId.HasValue || !IsVendorRole())
        {
            return Forbid();
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            const string sql = @"SELECT document_url
FROM identity.compliance_documents
WHERE document_id = @docId AND vendor_id = @vendorId;";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("docId", NpgsqlDbType.Uuid, documentId);
            cmd.Parameters.AddWithValue("vendorId", NpgsqlDbType.Uuid, vendorId.Value);

            var documentUrl = (string?)await cmd.ExecuteScalarAsync(ct);
            if (string.IsNullOrWhiteSpace(documentUrl))
            {
                return NotFound();
            }

            var filePath = Path.Combine(_environment.ContentRootPath, documentUrl.Replace("/", Path.DirectorySeparatorChar.ToString()));
            if (!System.IO.File.Exists(filePath))
            {
                return NotFound();
            }

            var contentType = "application/octet-stream";
            return PhysicalFile(filePath, contentType, Path.GetFileName(filePath), enableRangeProcessing: true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading compliance document {DocumentId} for vendor {VendorId}.", documentId, vendorId);
            return Problem("Internal server error downloading document.");
        }
    }

    [Authorize]
    [HttpGet("history/{documentType}")]
    public async Task<IActionResult> GetHistory(string documentType, CancellationToken ct)
    {
        var vendorId = GetVendorIdFromClaims();
        if (!vendorId.HasValue || !IsVendorRole())
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(documentType))
        {
            return BadRequest(new { message = "DocumentType is required." });
        }

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
            await using var cmd = new NpgsqlCommand("identity.get_vendor_compliance_document_history_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, vendorId.Value);
            cmd.Parameters.AddWithValue("p_document_type", NpgsqlDbType.Varchar, documentType);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var items = await ExecuteRefcursorAsync(cmd, MapHistoryItem, ct);
            await tx.CommitAsync(ct);

            return Ok(items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving compliance history for vendor {VendorId}.", vendorId);
            return Problem("Internal server error retrieving compliance history.");
        }
    }

    [Authorize]
    [HttpGet("history/file/{historyId:guid}")]
    public async Task<IActionResult> DownloadHistoryFile(Guid historyId, CancellationToken ct)
    {
        var vendorId = GetVendorIdFromClaims();
        if (!vendorId.HasValue || !IsVendorRole())
        {
            return Forbid();
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            const string sql = @"SELECT document_url
FROM identity.compliance_document_history
WHERE history_id = @historyId AND vendor_id = @vendorId;";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("historyId", NpgsqlDbType.Uuid, historyId);
            cmd.Parameters.AddWithValue("vendorId", NpgsqlDbType.Uuid, vendorId.Value);

            var documentUrl = (string?)await cmd.ExecuteScalarAsync(ct);
            if (string.IsNullOrWhiteSpace(documentUrl))
            {
                return NotFound();
            }

            var filePath = Path.Combine(_environment.ContentRootPath, documentUrl.Replace("/", Path.DirectorySeparatorChar.ToString()));
            if (!System.IO.File.Exists(filePath))
            {
                return NotFound();
            }

            var contentType = "application/octet-stream";
            return PhysicalFile(filePath, contentType, Path.GetFileName(filePath), enableRangeProcessing: true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading compliance history file {HistoryId} for vendor {VendorId}.", historyId, vendorId);
            return Problem("Internal server error downloading history file.");
        }
    }

    private static async Task<List<T>> ExecuteRefcursorAsync<T>(NpgsqlCommand cmd, Func<NpgsqlDataReader, T> map, CancellationToken ct)
    {
        await cmd.ExecuteNonQueryAsync(ct);
        var cursorName = (string)cmd.Parameters["p_result"].Value!;
        await using var fetch = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", cmd.Connection!, cmd.Transaction);
        await using var reader = await fetch.ExecuteReaderAsync(ct);

        var results = new List<T>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(map(reader));
        }

        return results;
    }

    private ComplianceDocumentResponse MapComplianceDocument(NpgsqlDataReader reader)
    {
        var documentId = reader.GetGuid(reader.GetOrdinal("document_id"));
        var expiryDate = reader.IsDBNull(reader.GetOrdinal("expiry_date")) ? (DateTime?)null : reader.GetDateTime(reader.GetOrdinal("expiry_date"));
        var status = reader.GetString(reader.GetOrdinal("verification_status"));

        return new ComplianceDocumentResponse(
            documentId,
            reader.GetString(reader.GetOrdinal("document_type")),
            status,
            expiryDate,
            reader.IsDBNull(reader.GetOrdinal("created_at")) ? (DateTime?)null : reader.GetDateTime(reader.GetOrdinal("created_at")),
            $"/api/Vendor/compliance/{documentId}/file",
            null);
    }

    private ComplianceDocumentResponse MapUploadedDocument(NpgsqlDataReader reader)
    {
        var documentId = reader.GetGuid(reader.GetOrdinal("document_id"));
        var status = reader.GetString(reader.GetOrdinal("verification_status"));

        return new ComplianceDocumentResponse(
            documentId,
            reader.GetString(reader.GetOrdinal("document_type")),
            status,
            null,
            DateTime.UtcNow,
            $"/api/Vendor/compliance/{documentId}/file",
            null);
    }

    private ComplianceHistoryItem MapHistoryItem(NpgsqlDataReader reader)
    {
        var historyId = reader.GetGuid(reader.GetOrdinal("history_id"));
        return new ComplianceHistoryItem(
            reader.GetGuid(reader.GetOrdinal("history_id")),
            reader.GetGuid(reader.GetOrdinal("document_id")),
            reader.GetString(reader.GetOrdinal("document_type")),
            reader.GetString(reader.GetOrdinal("document_url")),
            reader.IsDBNull(reader.GetOrdinal("expiry_date")) ? (DateTime?)null : reader.GetDateTime(reader.GetOrdinal("expiry_date")),
            reader.GetString(reader.GetOrdinal("verification_status")),
            reader.GetDateTime(reader.GetOrdinal("created_at")),
            $"/api/Vendor/compliance/history/file/{historyId}");
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

    public sealed record ComplianceUploadForm(
        string DocumentType,
        DateTime? ExpiryDate,
        IFormFile File);

    public sealed record ComplianceRequirement(
        string Id,
        string Name,
        bool Required,
        string Frequency,
        bool Expirable,
        string Description);

    public sealed record ComplianceDocumentResponse(
        Guid DocumentId,
        string DocumentType,
        string Status,
        DateTime? ExpiryDate,
        DateTime? CreatedAt,
        string FileUrl,
        string? RejectionReason);

    public sealed record ComplianceHistoryItem(
        Guid HistoryId,
        Guid DocumentId,
        string DocumentType,
        string DocumentUrl,
        DateTime? ExpiryDate,
        string Status,
        DateTime CreatedAt,
        string FileUrl);
}

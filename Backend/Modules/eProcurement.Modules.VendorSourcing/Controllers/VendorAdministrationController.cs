using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.VendorSourcing.DTOs;

namespace eProcurement.Modules.VendorSourcing.Controllers;

[ApiController]
[Authorize]
[Route("api/admin/vendors")]
public class VendorAdministrationController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<VendorAdministrationController> _logger;
    private readonly IWebHostEnvironment _environment;

    private static readonly HashSet<string> AllowedRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "admin",
        "ict_admin"
    };

    private static readonly Dictionary<string, string> RoleAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["system_administrator"] = "ict_admin"
    };

    public VendorAdministrationController(
        IConfiguration config,
        ILogger<VendorAdministrationController> logger,
        IWebHostEnvironment environment)
    {
        _config = config;
        _logger = logger;
        _environment = environment;
    }

    [HttpGet]
    public async Task<IActionResult> GetRegistrations(
        [FromQuery] string? status,
        [FromQuery] string? query,
        CancellationToken ct)
    {
        if (!UserHasAnyRole(AllowedRoles))
        {
            return Forbid();
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
SELECT
    v.vendor_id,
    v.company_name,
    v.registration_number,
    v.tax_id,
    v.contact_person,
    v.email,
    COALESCE(v.registration_date, v.created_at) AS registration_date,
    v.vendor_status,
    COALESCE(v.is_active, TRUE) AS is_active,
    COUNT(d.document_id)::int AS compliance_documents_count,
    COUNT(*) FILTER (WHERE d.verification_status = 'Approved')::int AS approved_documents_count,
    COUNT(*) FILTER (WHERE d.verification_status = 'Rejected')::int AS rejected_documents_count,
    COUNT(*) FILTER (
        WHERE d.document_id IS NOT NULL
          AND COALESCE(d.verification_status, 'Pending') NOT IN ('Approved', 'Rejected')
    )::int AS pending_documents_count,
    MAX(COALESCE(d.updated_at, d.created_at)) AS last_compliance_update_at
FROM identity.vendors v
LEFT JOIN identity.compliance_documents d ON d.vendor_id = v.vendor_id
WHERE
    (@p_status IS NULL OR LOWER(v.vendor_status) = LOWER(@p_status))
    AND (
        @p_query IS NULL
        OR v.company_name ILIKE '%' || @p_query || '%'
        OR v.registration_number ILIKE '%' || @p_query || '%'
        OR v.tax_id ILIKE '%' || @p_query || '%'
        OR v.contact_person ILIKE '%' || @p_query || '%'
        OR v.email ILIKE '%' || @p_query || '%'
    )
GROUP BY
    v.vendor_id,
    v.company_name,
    v.registration_number,
    v.tax_id,
    v.contact_person,
    v.email,
    COALESCE(v.registration_date, v.created_at),
    v.vendor_status,
    COALESCE(v.is_active, TRUE)
ORDER BY COALESCE(v.registration_date, v.created_at) DESC, v.company_name ASC;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)NormalizeStatusFilter(status) ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)NormalizeSearchQuery(query) ?? DBNull.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            var results = new List<VendorApprovalSummary>();
            while (await reader.ReadAsync(ct))
            {
                results.Add(MapSummary(reader));
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving vendor registrations for review.");
            return Problem("Internal server error retrieving vendor registrations.");
        }
    }

    [HttpGet("{vendorId:guid}")]
    public async Task<IActionResult> GetRegistration(Guid vendorId, CancellationToken ct)
    {
        if (!UserHasAnyRole(AllowedRoles))
        {
            return Forbid();
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string vendorSql = @"
SELECT
    v.vendor_id,
    v.company_name,
    v.registration_number,
    v.tax_id,
    v.company_address,
    v.contact_person,
    v.email,
    COALESCE(v.registration_date, v.created_at) AS registration_date,
    v.last_login,
    v.vendor_status,
    COALESCE(v.is_active, TRUE) AS is_active,
    COUNT(d.document_id)::int AS compliance_documents_count,
    COUNT(*) FILTER (WHERE d.verification_status = 'Approved')::int AS approved_documents_count,
    COUNT(*) FILTER (WHERE d.verification_status = 'Rejected')::int AS rejected_documents_count,
    COUNT(*) FILTER (
        WHERE d.document_id IS NOT NULL
          AND COALESCE(d.verification_status, 'Pending') NOT IN ('Approved', 'Rejected')
    )::int AS pending_documents_count,
    MAX(COALESCE(d.updated_at, d.created_at)) AS last_compliance_update_at
FROM identity.vendors v
LEFT JOIN identity.compliance_documents d ON d.vendor_id = v.vendor_id
WHERE v.vendor_id = @p_vendor_id
GROUP BY
    v.vendor_id,
    v.company_name,
    v.registration_number,
    v.tax_id,
    v.company_address,
    v.contact_person,
    v.email,
    COALESCE(v.registration_date, v.created_at),
    v.last_login,
    v.vendor_status,
    COALESCE(v.is_active, TRUE);";

        const string documentSql = @"
SELECT
    document_id,
    document_type,
    COALESCE(verification_status, 'Pending') AS verification_status,
    expiry_date,
    created_at,
    updated_at,
    verified_by,
    verified_at
FROM identity.compliance_documents
WHERE vendor_id = @p_vendor_id
ORDER BY created_at DESC, document_type ASC;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            VendorApprovalDetail? detail = null;

            await using (var vendorCmd = new NpgsqlCommand(vendorSql, conn))
            {
                vendorCmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, vendorId);
                await using var reader = await vendorCmd.ExecuteReaderAsync(ct);
                if (!await reader.ReadAsync(ct))
                {
                    return NotFound();
                }

                detail = MapDetailSkeleton(reader);
            }

            var documents = new List<VendorComplianceReviewItem>();
            await using (var documentCmd = new NpgsqlCommand(documentSql, conn))
            {
                documentCmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, vendorId);
                await using var reader = await documentCmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    documents.Add(MapDocument(reader));
                }
            }

            return Ok(detail! with { ComplianceDocuments = documents });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving vendor registration detail for {VendorId}.", vendorId);
            return Problem("Internal server error retrieving vendor registration detail.");
        }
    }

    [HttpPost("{vendorId:guid}/decision")]
    public async Task<IActionResult> DecideRegistration(
        Guid vendorId,
        [FromBody] VendorApprovalDecisionRequest request,
        CancellationToken ct)
    {
        if (!UserHasAnyRole(AllowedRoles))
        {
            return Forbid();
        }

        var normalizedStatus = NormalizeDecision(request.Decision);
        if (normalizedStatus is null)
        {
            return BadRequest(new { message = "Decision must be Approved, Rejected, or Pending Approval." });
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
UPDATE identity.vendors
SET
    vendor_status = @p_vendor_status,
    is_active = CASE WHEN @p_vendor_status = 'Rejected' THEN FALSE ELSE TRUE END,
    updated_by = @p_updated_by,
    updated_at = NOW()
WHERE vendor_id = @p_vendor_id
RETURNING
    vendor_id,
    company_name,
    registration_number,
    tax_id,
    contact_person,
    email,
    COALESCE(registration_date, created_at) AS registration_date,
    vendor_status,
    COALESCE(is_active, TRUE) AS is_active;";

        const string countsSql = @"
SELECT
    COUNT(document_id)::int AS compliance_documents_count,
    COUNT(*) FILTER (WHERE verification_status = 'Approved')::int AS approved_documents_count,
    COUNT(*) FILTER (WHERE verification_status = 'Rejected')::int AS rejected_documents_count,
    COUNT(*) FILTER (
        WHERE document_id IS NOT NULL
          AND COALESCE(verification_status, 'Pending') NOT IN ('Approved', 'Rejected')
    )::int AS pending_documents_count,
    MAX(COALESCE(updated_at, created_at)) AS last_compliance_update_at
FROM identity.compliance_documents
WHERE vendor_id = @p_vendor_id;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            VendorApprovalSummary? summary = null;

            await using (var cmd = new NpgsqlCommand(sql, conn))
            {
                cmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, vendorId);
                cmd.Parameters.AddWithValue("p_vendor_status", NpgsqlDbType.Varchar, normalizedStatus);
                cmd.Parameters.AddWithValue("p_updated_by", NpgsqlDbType.Varchar, GetDecisionActor());

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                if (!await reader.ReadAsync(ct))
                {
                    return NotFound();
                }

                summary = new VendorApprovalSummary(
                    reader.GetGuid(reader.GetOrdinal("vendor_id")),
                    reader.GetString(reader.GetOrdinal("company_name")),
                    reader.GetString(reader.GetOrdinal("registration_number")),
                    reader.GetString(reader.GetOrdinal("tax_id")),
                    reader.GetString(reader.GetOrdinal("contact_person")),
                    reader.GetString(reader.GetOrdinal("email")),
                    reader.GetDateTime(reader.GetOrdinal("registration_date")),
                    reader.GetString(reader.GetOrdinal("vendor_status")),
                    reader.GetBoolean(reader.GetOrdinal("is_active")),
                    0,
                    0,
                    0,
                    0,
                    null);
                }

            await using (var countsCmd = new NpgsqlCommand(countsSql, conn))
            {
                countsCmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, vendorId);
                await using var reader = await countsCmd.ExecuteReaderAsync(ct);
                if (await reader.ReadAsync(ct))
                {
                    summary = summary! with
                    {
                        ComplianceDocumentsCount = reader.GetInt32(reader.GetOrdinal("compliance_documents_count")),
                        ApprovedDocumentsCount = reader.GetInt32(reader.GetOrdinal("approved_documents_count")),
                        PendingDocumentsCount = reader.GetInt32(reader.GetOrdinal("pending_documents_count")),
                        RejectedDocumentsCount = reader.GetInt32(reader.GetOrdinal("rejected_documents_count")),
                        LastComplianceUpdateAt = GetNullableDateTime(reader, "last_compliance_update_at")
                    };
                }
            }

            return Ok(summary);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deciding vendor registration for {VendorId}.", vendorId);
            return Problem("Internal server error updating vendor registration status.");
        }
    }

    [HttpGet("compliance/{documentId:guid}/file")]
    public async Task<IActionResult> DownloadComplianceFile(Guid documentId, CancellationToken ct)
    {
        if (!UserHasAnyRole(AllowedRoles))
        {
            return Forbid();
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
SELECT document_url
FROM identity.compliance_documents
WHERE document_id = @p_document_id;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_document_id", NpgsqlDbType.Uuid, documentId);

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

            return PhysicalFile(filePath, "application/octet-stream", Path.GetFileName(filePath), enableRangeProcessing: true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading compliance document {DocumentId} for admin review.", documentId);
            return Problem("Internal server error downloading compliance document.");
        }
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    private bool UserHasAnyRole(IReadOnlySet<string> allowedRoles)
    {
        var role = GetNormalizedRole();
        return role is not null && allowedRoles.Contains(role);
    }

    private string? GetNormalizedRole()
    {
        var rawRole = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
        if (string.IsNullOrWhiteSpace(rawRole))
        {
            return null;
        }

        var withUnderscores = rawRole.Trim().Replace("-", "_").Replace(" ", "_");
        var normalized = System.Text.RegularExpressions.Regex
            .Replace(withUnderscores, "([a-z0-9])([A-Z])", "$1_$2")
            .ToLowerInvariant();

        return RoleAliases.TryGetValue(normalized, out var mapped) ? mapped : normalized;
    }

    private string GetDecisionActor() =>
        User.FindFirstValue(ClaimTypes.Email) ??
        User.FindFirstValue("email") ??
        User.FindFirstValue("sub") ??
        "system";

    private static string? NormalizeDecision(string? decision)
    {
        if (string.IsNullOrWhiteSpace(decision))
        {
            return null;
        }

        var normalized = decision.Trim().ToLowerInvariant();
        return normalized switch
        {
            "approved" => "Active",
            "active" => "Active",
            "rejected" => "Rejected",
            "pending" => "Pending Approval",
            "pending approval" => "Pending Approval",
            _ => null
        };
    }

    private static string? NormalizeStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        return NormalizeDecision(status) ?? status.Trim();
    }

    private static string? NormalizeSearchQuery(string? query)
    {
        var trimmed = query?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static VendorApprovalSummary MapSummary(NpgsqlDataReader reader) =>
        new(
            reader.GetGuid(reader.GetOrdinal("vendor_id")),
            reader.GetString(reader.GetOrdinal("company_name")),
            reader.GetString(reader.GetOrdinal("registration_number")),
            reader.GetString(reader.GetOrdinal("tax_id")),
            reader.GetString(reader.GetOrdinal("contact_person")),
            reader.GetString(reader.GetOrdinal("email")),
            reader.GetDateTime(reader.GetOrdinal("registration_date")),
            reader.GetString(reader.GetOrdinal("vendor_status")),
            reader.GetBoolean(reader.GetOrdinal("is_active")),
            reader.GetInt32(reader.GetOrdinal("compliance_documents_count")),
            reader.GetInt32(reader.GetOrdinal("approved_documents_count")),
            reader.GetInt32(reader.GetOrdinal("pending_documents_count")),
            reader.GetInt32(reader.GetOrdinal("rejected_documents_count")),
            GetNullableDateTime(reader, "last_compliance_update_at"));

    private static VendorApprovalDetail MapDetailSkeleton(NpgsqlDataReader reader) =>
        new(
            reader.GetGuid(reader.GetOrdinal("vendor_id")),
            reader.GetString(reader.GetOrdinal("company_name")),
            reader.GetString(reader.GetOrdinal("registration_number")),
            reader.GetString(reader.GetOrdinal("tax_id")),
            reader.GetString(reader.GetOrdinal("company_address")),
            reader.GetString(reader.GetOrdinal("contact_person")),
            reader.GetString(reader.GetOrdinal("email")),
            reader.GetDateTime(reader.GetOrdinal("registration_date")),
            GetNullableDateTime(reader, "last_login"),
            reader.GetString(reader.GetOrdinal("vendor_status")),
            reader.GetBoolean(reader.GetOrdinal("is_active")),
            reader.GetInt32(reader.GetOrdinal("compliance_documents_count")),
            reader.GetInt32(reader.GetOrdinal("approved_documents_count")),
            reader.GetInt32(reader.GetOrdinal("pending_documents_count")),
            reader.GetInt32(reader.GetOrdinal("rejected_documents_count")),
            GetNullableDateTime(reader, "last_compliance_update_at"),
            Array.Empty<VendorComplianceReviewItem>());

    private static VendorComplianceReviewItem MapDocument(NpgsqlDataReader reader)
    {
        var documentId = reader.GetGuid(reader.GetOrdinal("document_id"));
        return new VendorComplianceReviewItem(
            documentId,
            reader.GetString(reader.GetOrdinal("document_type")),
            reader.GetString(reader.GetOrdinal("verification_status")),
            GetNullableDateTime(reader, "expiry_date"),
            reader.GetDateTime(reader.GetOrdinal("created_at")),
            reader.GetDateTime(reader.GetOrdinal("updated_at")),
            GetNullableString(reader, "verified_by"),
            GetNullableDateTime(reader, "verified_at"),
            $"/api/admin/vendors/compliance/{documentId}/file");
    }

    private static string? GetNullableString(NpgsqlDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    private static DateTime? GetNullableDateTime(NpgsqlDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
    }
}

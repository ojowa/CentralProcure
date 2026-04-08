using System.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.VendorSourcing.DTOs;
using Microsoft.AspNetCore.Hosting;

namespace eProcurement.Modules.VendorSourcing.Services;

public class VendorComplianceService : IVendorComplianceService
{
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<VendorComplianceService> _logger;

    private static readonly IReadOnlyList<ComplianceRequirement> Requirements = new[]
    {
        new ComplianceRequirement("cac_certificate", "CAC Certificate", true, "One-time", false, "Corporate Affairs Commission registration certificate."),
        new ComplianceRequirement("tax_clearance", "Tax Clearance Certificate", true, "Annual", true, "Most recent tax clearance certificate."),
        new ComplianceRequirement("pencom_certificate", "PENCOM Compliance Certificate", true, "Annual", true, "Pension compliance certificate (PENCOM)."),
        new ComplianceRequirement("itf_certificate", "ITF Compliance Certificate", true, "Annual", true, "Industrial Training Fund compliance certificate."),
        new ComplianceRequirement("company_profile", "Company Profile", true, "As needed", false, "Company overview, ownership, and experience."),
        new ComplianceRequirement("bank_reference", "Bank Reference Letter", false, "As needed", true, "Bank reference letter or statement of good standing."),
        new ComplianceRequirement("insurance_certificate", "Insurance Certificate", false, "Annual", true, "Valid insurance coverage certificate.")
    };

    public VendorComplianceService(IConfiguration config, IWebHostEnvironment environment, ILogger<VendorComplianceService> logger)
    {
        _config = config;
        _environment = environment;
        _logger = logger;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;
    private string UploadRoot => Path.Combine(_environment.ContentRootPath, "uploads", "compliance");

    public IReadOnlyList<ComplianceRequirement> GetRequirements() => Requirements;

    public async Task<List<ComplianceDocumentResponse>> GetDocumentsAsync(Guid vendorId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("identity.get_vendor_compliance_documents_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, vendorId);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
        var results = await ExecuteRefcursorAsync(cmd, MapComplianceDocument, ct);
        await tx.CommitAsync(ct);
        return results;
    }

    public async Task<ComplianceDocumentResponse> UploadDocumentAsync(Guid vendorId, string documentType, DateTime? expiryDate, IFormFile file, CancellationToken ct)
    {
        Directory.CreateDirectory(UploadRoot);
        var safeFileName = Path.GetFileName(file.FileName);
        var extension = Path.GetExtension(safeFileName);
        var safeDocType = new string(documentType.Where(ch => char.IsLetterOrDigit(ch) || ch == '_' || ch == '-').ToArray());
        if (string.IsNullOrWhiteSpace(safeDocType)) safeDocType = "document";
        
        var fileName = $"{vendorId:N}_{safeDocType}_{DateTime.UtcNow:yyyyMMddHHmmss}{extension}";
        var filePath = Path.Combine(UploadRoot, fileName);

        await using (var stream = System.IO.File.Create(filePath))
        {
            await file.CopyToAsync(stream, ct);
        }

        var relativePath = Path.Combine("uploads", "compliance", fileName).Replace("\\", "/");
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("identity.upload_compliance_document_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, vendorId);
        cmd.Parameters.AddWithValue("p_document_type", NpgsqlDbType.Varchar, documentType);
        cmd.Parameters.AddWithValue("p_document_url", NpgsqlDbType.Text, relativePath);
        cmd.Parameters.AddWithValue("p_expiry_date", NpgsqlDbType.Date, (object?)expiryDate ?? DBNull.Value);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
        
        var results = await ExecuteRefcursorAsync(cmd, MapUploadedDocument, ct);
        await tx.CommitAsync(ct);
        
        var result = results.FirstOrDefault() ?? throw new InvalidOperationException("Upload failed.");
        return result with { ExpiryDate = expiryDate };
    }

    public async Task<string?> GetDocumentUrlAsync(Guid vendorId, Guid documentId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT document_url FROM identity.compliance_documents WHERE document_id = @docId AND vendor_id = @vendorId;", conn);
        cmd.Parameters.AddWithValue("docId", NpgsqlDbType.Uuid, documentId);
        cmd.Parameters.AddWithValue("vendorId", NpgsqlDbType.Uuid, vendorId);
        return (string?)await cmd.ExecuteScalarAsync(ct);
    }

    public async Task<List<ComplianceHistoryItem>> GetHistoryAsync(Guid vendorId, string documentType, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("identity.get_vendor_compliance_document_history_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_vendor_id", NpgsqlDbType.Uuid, vendorId);
        cmd.Parameters.AddWithValue("p_document_type", NpgsqlDbType.Varchar, documentType);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
        var results = await ExecuteRefcursorAsync(cmd, MapHistoryItem, ct);
        await tx.CommitAsync(ct);
        return results;
    }

    public async Task<string?> GetHistoryFileUrlAsync(Guid vendorId, Guid historyId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT document_url FROM identity.compliance_document_history WHERE history_id = @historyId AND vendor_id = @vendorId;", conn);
        cmd.Parameters.AddWithValue("historyId", NpgsqlDbType.Uuid, historyId);
        cmd.Parameters.AddWithValue("vendorId", NpgsqlDbType.Uuid, vendorId);
        return (string?)await cmd.ExecuteScalarAsync(ct);
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

    private ComplianceDocumentResponse MapComplianceDocument(NpgsqlDataReader r) { var id = r.GetGuid(0); return new ComplianceDocumentResponse(id, r.GetString(1), r.GetString(2), r.IsDBNull(3) ? null : r.GetDateTime(3), r.IsDBNull(4) ? null : r.GetDateTime(4), $"/api/Vendor/compliance/{id}/file", null); }
    private ComplianceDocumentResponse MapUploadedDocument(NpgsqlDataReader r) { var id = r.GetGuid(0); return new ComplianceDocumentResponse(id, r.GetString(1), r.GetString(2), null, DateTime.UtcNow, $"/api/Vendor/compliance/{id}/file", null); }
    private ComplianceHistoryItem MapHistoryItem(NpgsqlDataReader r) { var id = r.GetGuid(0); return new ComplianceHistoryItem(id, r.GetGuid(1), r.GetString(2), r.GetString(3), r.IsDBNull(4) ? null : r.GetDateTime(4), r.GetString(5), r.GetDateTime(6), $"/api/Vendor/compliance/history/file/{id}"); }
}

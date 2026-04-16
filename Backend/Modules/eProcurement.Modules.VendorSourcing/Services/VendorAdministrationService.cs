using System.Data;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.VendorSourcing.DTOs;

namespace eProcurement.Modules.VendorSourcing.Services;

public class VendorAdministrationService : IVendorAdministrationService
{
    private readonly IConfiguration _config;
    private readonly ILogger<VendorAdministrationService> _logger;

    public VendorAdministrationService(IConfiguration config, ILogger<VendorAdministrationService> logger)
    {
        _config = config;
        _logger = logger;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    public async Task<List<VendorApprovalSummary>> GetRegistrationsAsync(string? status, string? query, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        const string sql = @"
            SELECT v.vendor_id, v.company_name, v.registration_number, v.tax_id, v.contact_person, v.phone_number, v.email, COALESCE(v.registration_date, v.created_at) AS registration_date, v.vendor_status, COALESCE(v.is_active, TRUE) AS is_active,
                   COUNT(d.document_id)::int AS compliance_documents_count, COUNT(*) FILTER (WHERE d.verification_status = 'Approved')::int AS approved_documents_count, COUNT(*) FILTER (WHERE d.verification_status = 'Rejected')::int AS rejected_documents_count,
                   COUNT(*) FILTER (WHERE d.document_id IS NOT NULL AND COALESCE(d.verification_status, 'Pending') NOT IN ('Approved', 'Rejected'))::int AS pending_documents_count, MAX(COALESCE(d.updated_at, d.created_at)) AS last_compliance_update_at
            FROM identity.vendors v LEFT JOIN identity.compliance_documents d ON d.vendor_id = v.vendor_id
            WHERE (@p_status::text IS NULL OR LOWER(v.vendor_status) = LOWER(@p_status)) AND (@p_query::text IS NULL OR v.company_name ILIKE '%' || @p_query || '%' OR v.registration_number ILIKE '%' || @p_query || '%' OR v.tax_id ILIKE '%' || @p_query || '%' OR v.contact_person ILIKE '%' || @p_query || '%' OR COALESCE(v.phone_number, '') ILIKE '%' || @p_query || '%' OR v.email ILIKE '%' || @p_query || '%')
            GROUP BY v.vendor_id, v.company_name, v.registration_number, v.tax_id, v.contact_person, v.phone_number, v.email, COALESCE(v.registration_date, v.created_at), v.vendor_status, COALESCE(v.is_active, TRUE)
            ORDER BY COALESCE(v.registration_date, v.created_at) DESC, v.company_name ASC;";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_status", (object?)NormalizeStatusFilter(status) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_query", (object?)NormalizeSearchQuery(query) ?? DBNull.Value);
        var results = new List<VendorApprovalSummary>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) results.Add(MapSummary(reader));
        return results;
    }

    public async Task<VendorApprovalDetail?> GetRegistrationAsync(Guid vendorId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        const string vSql = @"SELECT v.vendor_id, v.company_name, v.registration_number, v.tax_id, v.company_address, v.contact_person, v.phone_number, v.email, COALESCE(v.registration_date, v.created_at) AS registration_date, v.last_login, v.vendor_status, COALESCE(v.is_active, TRUE) AS is_active,
                               COUNT(d.document_id)::int AS compliance_documents_count, COUNT(*) FILTER (WHERE d.verification_status = 'Approved')::int AS approved_documents_count, COUNT(*) FILTER (WHERE d.verification_status = 'Rejected')::int AS rejected_documents_count,
                               COUNT(*) FILTER (WHERE d.document_id IS NOT NULL AND COALESCE(d.verification_status, 'Pending') NOT IN ('Approved', 'Rejected'))::int AS pending_documents_count, MAX(COALESCE(d.updated_at, d.created_at)) AS last_compliance_update_at
                               FROM identity.vendors v LEFT JOIN identity.compliance_documents d ON d.vendor_id = v.vendor_id WHERE v.vendor_id = @p_vendor_id
                               GROUP BY v.vendor_id, v.company_name, v.registration_number, v.tax_id, v.company_address, v.contact_person, v.phone_number, v.email, COALESCE(v.registration_date, v.created_at), v.last_login, v.vendor_status, COALESCE(v.is_active, TRUE);";
        await using var vCmd = new NpgsqlCommand(vSql, conn);
        vCmd.Parameters.AddWithValue("p_vendor_id", vendorId);
        await using var vReader = await vCmd.ExecuteReaderAsync(ct);
        if (!await vReader.ReadAsync(ct)) return null;
        var detail = MapDetailSkeleton(vReader);
        await vReader.CloseAsync();

        const string dSql = "SELECT document_id, document_type, COALESCE(verification_status, 'Pending') AS verification_status, expiry_date, created_at, updated_at, verified_by, verified_at FROM identity.compliance_documents WHERE vendor_id = @p_vendor_id ORDER BY created_at DESC, document_type ASC;";
        await using var dCmd = new NpgsqlCommand(dSql, conn);
        dCmd.Parameters.AddWithValue("p_vendor_id", vendorId);
        var docs = new List<VendorComplianceReviewItem>();
        await using var dReader = await dCmd.ExecuteReaderAsync(ct);
        while (await dReader.ReadAsync(ct)) docs.Add(MapDocument(dReader));
        return detail with { ComplianceDocuments = docs };
    }

    public async Task<VendorApprovalSummary?> DecideRegistrationAsync(Guid vendorId, VendorApprovalDecisionRequest request, string actor, CancellationToken ct)
    {
        var status = NormalizeDecision(request.Decision) ?? throw new ArgumentException("Invalid decision.");
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT identity.approve_vendor_registration(@p_vendor_id, @p_vendor_status, @p_updated_by, @p_notes);", conn, tx);
        cmd.Parameters.AddWithValue("p_vendor_id", vendorId); cmd.Parameters.AddWithValue("p_vendor_status", status); cmd.Parameters.AddWithValue("p_updated_by", actor); cmd.Parameters.AddWithValue("p_notes", (object?)request.Notes ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);

        const string sSql = @"SELECT v.vendor_id, v.company_name, v.registration_number, v.tax_id, v.contact_person, v.phone_number, v.email, COALESCE(v.registration_date, v.created_at) AS registration_date, v.vendor_status, COALESCE(v.is_active, TRUE) AS is_active,
                               COUNT(d.document_id)::int AS compliance_documents_count, COUNT(*) FILTER (WHERE d.verification_status = 'Approved')::int AS approved_documents_count, COUNT(*) FILTER (WHERE d.verification_status = 'Rejected')::int AS rejected_documents_count,
                               COUNT(*) FILTER (WHERE d.document_id IS NOT NULL AND COALESCE(d.verification_status, 'Pending') NOT IN ('Approved', 'Rejected'))::int AS pending_documents_count, MAX(COALESCE(d.updated_at, d.created_at)) AS last_compliance_update_at
                               FROM identity.vendors v LEFT JOIN identity.compliance_documents d ON d.vendor_id = v.vendor_id WHERE v.vendor_id = @p_vendor_id
                               GROUP BY v.vendor_id, v.company_name, v.registration_number, v.tax_id, v.contact_person, v.phone_number, v.email, COALESCE(v.registration_date, v.created_at), v.vendor_status, COALESCE(v.is_active, TRUE);";
        await using var sCmd = new NpgsqlCommand(sSql, conn, tx);
        sCmd.Parameters.AddWithValue("p_vendor_id", vendorId);
        VendorApprovalSummary? result = null;
        await using (var reader = await sCmd.ExecuteReaderAsync(ct))
        {
            if (await reader.ReadAsync(ct)) result = MapSummary(reader);
        }
        await tx.CommitAsync(ct);
        return result;
    }

    public async Task<string?> GetComplianceDocumentUrlAsync(Guid documentId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT document_url FROM identity.compliance_documents WHERE document_id = @p_document_id;", conn);
        cmd.Parameters.AddWithValue("p_document_id", documentId);
        return (string?)await cmd.ExecuteScalarAsync(ct);
    }

    private static string? NormalizeDecision(string? decision) => decision?.Trim().ToLowerInvariant() switch { "approved" or "active" => "Active", "rejected" => "Rejected", "pending" or "pending approval" => "Pending Approval", _ => null };
    private static string? NormalizeStatusFilter(string? status) => NormalizeDecision(status) ?? status?.Trim();
    private static string? NormalizeSearchQuery(string? query) => string.IsNullOrWhiteSpace(query?.Trim()) ? null : query.Trim();

    private static VendorApprovalSummary MapSummary(NpgsqlDataReader r) => new(r.GetGuid(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4), r.IsDBNull(5) ? null : r.GetString(5), r.GetString(6), r.GetDateTime(7), r.GetString(8), r.GetBoolean(9), r.GetInt32(10), r.GetInt32(11), r.GetInt32(13), r.GetInt32(12), r.IsDBNull(14) ? null : r.GetDateTime(14));
    private static VendorApprovalDetail MapDetailSkeleton(NpgsqlDataReader r) => new(r.GetGuid(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4), r.GetString(5), r.IsDBNull(6) ? null : r.GetString(6), r.GetString(7), r.GetDateTime(8), r.IsDBNull(9) ? null : r.GetDateTime(9), r.GetString(10), r.GetBoolean(11), r.GetInt32(12), r.GetInt32(13), r.GetInt32(15), r.GetInt32(14), r.IsDBNull(16) ? null : r.GetDateTime(16), Array.Empty<VendorComplianceReviewItem>());
    private static VendorComplianceReviewItem MapDocument(NpgsqlDataReader r) { var id = r.GetGuid(0); return new VendorComplianceReviewItem(id, r.GetString(1), r.GetString(2), r.IsDBNull(3) ? null : r.GetDateTime(3), r.GetDateTime(4), r.GetDateTime(5), r.IsDBNull(6) ? null : r.GetString(6), r.IsDBNull(7) ? null : r.GetDateTime(7), $"/api/admin/vendors/compliance/{id}/file"); }
}

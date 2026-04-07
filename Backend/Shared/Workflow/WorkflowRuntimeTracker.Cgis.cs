using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Shared.Workflow;

public sealed partial class WorkflowRuntimeTracker
{
    public async Task<IReadOnlyList<CgisQueueItem>> GetCgisQueueAsync(
        string connectionString,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Array.Empty<CgisQueueItem>();
        }

        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);

        const string sql = @"
SELECT
    wi.instance_id,
    wi.entity_type,
    wi.entity_id,
    wi.record_title,
    COALESCE(r.department, t.department, 'N/A') as department,
    wi.amount,
    at.approval_route,
    at.approval_authority_label,
    wi.current_status as status,
    v.company_name as vendor_name,
    wi.created_at,
    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - wi.created_at))::int as days_pending
FROM procurement_workflow.workflow_instances wi
LEFT JOIN procurement_workflow.approval_thresholds at ON at.threshold_id = wi.threshold_id
LEFT JOIN procurement_workflow.requisitions r ON wi.entity_type = 'requisition' AND r.requisition_id = wi.entity_id
LEFT JOIN vendor_sourcing.tenders t ON wi.entity_type = 'tender' AND t.tender_id = wi.entity_id
LEFT JOIN vendor_sourcing.bids b ON wi.entity_type = 'tender' AND b.tender_id = wi.entity_id AND b.status = 'Recommended'
LEFT JOIN identity.vendors v ON b.vendor_id = v.vendor_id
WHERE wi.current_stage_key = 'accounting_officer_review'
ORDER BY wi.created_at DESC;";

        var results = new List<CgisQueueItem>();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(new CgisQueueItem(
                reader.GetGuid(reader.GetOrdinal("instance_id")),
                reader.GetString(reader.GetOrdinal("entity_type")),
                reader.GetGuid(reader.GetOrdinal("entity_id")),
                GetNullableString(reader, "record_title"),
                reader.GetString(reader.GetOrdinal("department")),
                GetNullableDecimal(reader, "amount"),
                GetNullableString(reader, "approval_route"),
                GetNullableString(reader, "approval_authority_label"),
                GetNullableString(reader, "status"),
                GetNullableString(reader, "vendor_name"),
                reader.GetDateTime(reader.GetOrdinal("created_at")),
                reader.GetInt32(reader.GetOrdinal("days_pending"))));
        }

        return results;
    }

    public async Task<IReadOnlyList<CgisDocument>> GetCgisDocumentsAsync(
        string connectionString,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Array.Empty<CgisDocument>();
        }

        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);

        const string sql = @"
WITH recommended_bid AS (
    SELECT vendor_id, technical_proposal_url, updated_at
    FROM vendor_sourcing.bids
    WHERE tender_id = @p_entity_id AND status = 'Recommended'
    LIMIT 1
)
SELECT 'Technical Proposal' as doc_type, 'Proposal.pdf' as file_name, technical_proposal_url as file_url, 'Submitted' as status, updated_at
FROM recommended_bid
WHERE technical_proposal_url IS NOT NULL
UNION ALL
SELECT vcd.document_type, vcd.document_type || '.pdf' as file_name, vcd.document_url as file_url, vcd.verification_status as status, vcd.updated_at
FROM recommended_bid rb
JOIN identity.compliance_documents vcd ON vcd.vendor_id = rb.vendor_id;";

        var results = new List<CgisDocument>();
        if (!string.Equals(entityType, "tender", StringComparison.OrdinalIgnoreCase))
        {
            return results;
        }

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(new CgisDocument(
                reader.GetString(reader.GetOrdinal("doc_type")),
                GetNullableString(reader, "file_name"),
                GetNullableString(reader, "file_url"),
                GetNullableString(reader, "status"),
                reader.IsDBNull(reader.GetOrdinal("updated_at")) ? null : reader.GetDateTime(reader.GetOrdinal("updated_at"))));
        }

        return results;
    }
}

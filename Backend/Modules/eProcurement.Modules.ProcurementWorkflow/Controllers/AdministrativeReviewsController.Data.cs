using eProcurement.Modules.ProcurementWorkflow.DTOs;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class AdministrativeReviewsController
{
    private async Task<AdministrativeReviewDetail> InsertComplaintAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        AdministrativeReviewCreateRequest request,
        string stageKeyAtFiling,
        CancellationToken ct)
    {
        const string sql = @"
INSERT INTO procurement_workflow.procurement_complaints (
    complaint_reference,
    entity_type,
    entity_id,
    stage_key_at_filing,
    status,
    subject,
    summary,
    details,
    complaint_channel,
    requested_remedy,
    filed_by,
    assigned_to
)
VALUES (
    CONCAT('ADR-', TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'), '-', UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 6))),
    @p_entity_type,
    @p_entity_id,
    @p_stage_key_at_filing,
    'Filed',
    @p_subject,
    @p_summary,
    @p_details,
    @p_complaint_channel,
    @p_requested_remedy,
    @p_filed_by,
    @p_assigned_to
)
RETURNING
    complaint_id;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, request.EntityType.Trim().ToLowerInvariant());
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, request.EntityId);
        cmd.Parameters.AddWithValue("p_stage_key_at_filing", NpgsqlDbType.Varchar, stageKeyAtFiling);
        cmd.Parameters.AddWithValue("p_subject", NpgsqlDbType.Varchar, request.Subject.Trim());
        cmd.Parameters.AddWithValue("p_summary", NpgsqlDbType.Text, request.Summary.Trim());
        cmd.Parameters.AddWithValue("p_details", NpgsqlDbType.Text, request.Details.Trim());
        cmd.Parameters.AddWithValue("p_complaint_channel", NpgsqlDbType.Varchar, (object?)NormalizeNullable(request.ComplaintChannel) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_requested_remedy", NpgsqlDbType.Text, (object?)NormalizeNullable(request.RequestedRemedy) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_filed_by", NpgsqlDbType.Varchar, (object?)NormalizeNullable(request.FiledBy) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_assigned_to", NpgsqlDbType.Varchar, (object?)NormalizeNullable(request.AssignedTo) ?? DBNull.Value);

        var complaintId = (Guid?)await cmd.ExecuteScalarAsync(ct);
        return (await GetComplaintAsync(conn, tx, complaintId ?? Guid.Empty, ct))
            ?? throw new InvalidOperationException("Inserted complaint could not be reloaded.");
    }

    private async Task<AdministrativeReviewDetail> UpdateComplaintAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid complaintId,
        AdministrativeReviewUpdateRequest request,
        string? normalizedStatus,
        string? normalizedOutcome,
        string? resolutionStageKey,
        CancellationToken ct)
    {
        const string sql = @"
UPDATE procurement_workflow.procurement_complaints
SET
    status = COALESCE(@p_status, status),
    assigned_to = COALESCE(@p_assigned_to, assigned_to),
    reviewed_by = COALESCE(@p_reviewed_by, reviewed_by),
    resolution_outcome = COALESCE(@p_resolution_outcome, resolution_outcome),
    resolution_stage_key = COALESCE(@p_resolution_stage_key, resolution_stage_key),
    resolution_notes = COALESCE(@p_resolution_notes, resolution_notes),
    reviewed_at = CASE
        WHEN @p_reviewed_by IS NOT NULL OR COALESCE(@p_status, status) IN ('In Review', 'Escalated', 'Resolved', 'Rejected', 'Closed')
            THEN COALESCE(reviewed_at, NOW())
        ELSE reviewed_at
    END,
    resolved_at = CASE
        WHEN COALESCE(@p_status, status) IN ('Resolved', 'Rejected', 'Closed')
            THEN COALESCE(resolved_at, NOW())
        ELSE resolved_at
    END,
    updated_at = NOW()
WHERE complaint_id = @p_complaint_id
RETURNING
    complaint_id;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_complaint_id", NpgsqlDbType.Uuid, complaintId);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_assigned_to", NpgsqlDbType.Varchar, (object?)NormalizeNullable(request.AssignedTo) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_reviewed_by", NpgsqlDbType.Varchar, (object?)NormalizeNullable(request.ReviewedBy) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_resolution_outcome", NpgsqlDbType.Varchar, (object?)normalizedOutcome ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_resolution_stage_key", NpgsqlDbType.Varchar, (object?)resolutionStageKey ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_resolution_notes", NpgsqlDbType.Text, (object?)NormalizeNullable(request.ResolutionNotes) ?? DBNull.Value);

        var updatedComplaintId = (Guid?)await cmd.ExecuteScalarAsync(ct);
        return (await GetComplaintAsync(conn, tx, updatedComplaintId ?? complaintId, ct))
            ?? throw new InvalidOperationException("Updated complaint could not be reloaded.");
    }

    private static async Task<AdministrativeReviewDetail?> GetComplaintAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid complaintId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT
    pc.complaint_id,
    pc.complaint_reference,
    pc.entity_type,
    pc.entity_id,
    pc.stage_key_at_filing,
    pc.status,
    pc.subject,
    pc.summary,
    pc.details,
    pc.complaint_channel,
    pc.requested_remedy,
    pc.filed_by,
    pc.assigned_to,
    pc.reviewed_by,
    pc.resolution_outcome,
    pc.resolution_stage_key,
    pc.resolution_notes,
    pc.filed_at,
    pc.reviewed_at,
    pc.resolved_at,
    pc.created_at,
    pc.updated_at,
    wi.record_title AS parent_record_title,
    wi.current_stage_key AS parent_current_stage_key,
    wsc.stage_title AS parent_current_stage_title,
    wi.current_status AS parent_current_status
FROM procurement_workflow.procurement_complaints pc
LEFT JOIN procurement_workflow.workflow_instances wi
  ON wi.entity_type = pc.entity_type
 AND wi.entity_id = pc.entity_id
LEFT JOIN procurement_workflow.workflow_stage_catalog wsc
  ON wsc.stage_key = wi.current_stage_key
WHERE pc.complaint_id = @p_complaint_id
FOR UPDATE;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_complaint_id", NpgsqlDbType.Uuid, complaintId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return MapDetail(reader);
    }

    private static async Task<WorkflowInstanceState?> GetWorkflowInstanceAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    parent_entity_type,
    parent_entity_id,
    amount,
    procurement_type,
    threshold_id
FROM procurement_workflow.workflow_instances
WHERE entity_type = @p_entity_type
  AND entity_id = @p_entity_id
FOR UPDATE;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, entityType);
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new WorkflowInstanceState(
            reader.GetString(reader.GetOrdinal("entity_type")),
            reader.GetGuid(reader.GetOrdinal("entity_id")),
            reader.GetString(reader.GetOrdinal("current_stage_key")),
            GetNullableString(reader, "current_status"),
            GetNullableString(reader, "record_title"),
            GetNullableString(reader, "parent_entity_type"),
            GetNullableGuid(reader, "parent_entity_id"),
            GetNullableDecimal(reader, "amount"),
            GetNullableString(reader, "procurement_type"),
            GetNullableGuid(reader, "threshold_id"));
    }

    private sealed record WorkflowInstanceState(
        string EntityType,
        Guid EntityId,
        string CurrentStageKey,
        string? CurrentStatus,
        string? RecordTitle,
        string? ParentEntityType,
        Guid? ParentEntityId,
        decimal? Amount,
        string? ProcurementType,
        Guid? ThresholdId);
}

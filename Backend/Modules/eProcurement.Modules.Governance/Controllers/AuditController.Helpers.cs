using eProcurement.Modules.Governance.DTOs;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Governance.Controllers;

public partial class AuditController
{
    private static AuditCloseoutItem MapCloseout(NpgsqlDataReader reader)
    {
        return new AuditCloseoutItem(
            reader.GetGuid(reader.GetOrdinal("closeout_id")),
            reader.GetString(reader.GetOrdinal("closeout_reference")),
            reader.GetString(reader.GetOrdinal("entity_type")),
            reader.GetGuid(reader.GetOrdinal("entity_id")),
            reader.GetString(reader.GetOrdinal("status")),
            GetNullableString(reader, "record_title"),
            reader.GetString(reader.GetOrdinal("summary")),
            GetNullableString(reader, "archive_location"),
            reader.GetBoolean(reader.GetOrdinal("final_acceptance_completed")),
            reader.GetBoolean(reader.GetOrdinal("final_payment_completed")),
            GetNullableString(reader, "archived_by"),
            GetNullableDateTime(reader, "archived_at"),
            reader.GetDateTime(reader.GetOrdinal("created_at")));
    }

    private static string? ValidateCreateCloseoutRequest(AuditCloseoutCreateRequest? request)
    {
        if (request is null)
        {
            return "Request body is required.";
        }

        if (string.IsNullOrWhiteSpace(request.EntityType))
        {
            return "EntityType is required.";
        }

        if (request.EntityId == Guid.Empty)
        {
            return "EntityId is required.";
        }

        if (string.IsNullOrWhiteSpace(request.Summary) || request.Summary.Trim().Length < 10)
        {
            return "Summary must be at least 10 characters.";
        }

        return null;
    }

    private async Task<AuditCloseoutItem> InsertCloseoutAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        AuditCloseoutCreateRequest request,
        string? recordTitle,
        CancellationToken ct)
    {
        const string sql = @"
INSERT INTO procurement_workflow.procurement_closeouts (
    closeout_reference,
    entity_type,
    entity_id,
    status,
    record_title,
    summary,
    archive_location,
    final_acceptance_completed,
    final_payment_completed,
    archived_by,
    archived_at
)
VALUES (
    CONCAT('CLS-', TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'), '-', UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 6))),
    @p_entity_type,
    @p_entity_id,
    'Archived',
    @p_record_title,
    @p_summary,
    @p_archive_location,
    @p_final_acceptance_completed,
    @p_final_payment_completed,
    @p_archived_by,
    NOW()
)
RETURNING
    closeout_id,
    closeout_reference,
    entity_type,
    entity_id,
    status,
    record_title,
    summary,
    archive_location,
    final_acceptance_completed,
    final_payment_completed,
    archived_by,
    archived_at,
    created_at;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, request.EntityType.Trim().ToLowerInvariant());
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, request.EntityId);
        cmd.Parameters.AddWithValue("p_record_title", NpgsqlDbType.Varchar, (object?)recordTitle ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_summary", NpgsqlDbType.Text, request.Summary.Trim());
        cmd.Parameters.AddWithValue("p_archive_location", NpgsqlDbType.Text, (object?)NormalizeNullable(request.ArchiveLocation) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_final_acceptance_completed", NpgsqlDbType.Boolean, request.FinalAcceptanceCompleted);
        cmd.Parameters.AddWithValue("p_final_payment_completed", NpgsqlDbType.Boolean, request.FinalPaymentCompleted);
        cmd.Parameters.AddWithValue("p_archived_by", NpgsqlDbType.Varchar, (object?)NormalizeNullable(request.ArchivedBy) ?? DBNull.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return MapCloseout(reader);
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

    private static string? NormalizeNullable(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

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

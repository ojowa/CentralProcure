using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Shared.Workflow;

public sealed partial class WorkflowRuntimeTracker
{
    private static string NormalizeEntityType(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("EntityType is required.", nameof(value));
        }

        return value.Trim().ToLowerInvariant();
    }

    private static string? NormalizeNullable(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private async Task<CurrentInstanceState?> GetCurrentInstanceAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT instance_id, current_stage_key, current_status
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

        return new CurrentInstanceState(
            reader.GetGuid(reader.GetOrdinal("instance_id")),
            reader.GetString(reader.GetOrdinal("current_stage_key")),
            GetNullableString(reader, "current_status"));
    }

    private async Task<Guid> InsertInstanceAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        WorkflowRuntimeSyncRequest request,
        CancellationToken ct)
    {
        const string sql = @"
INSERT INTO procurement_workflow.workflow_instances (
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    parent_entity_type,
    parent_entity_id,
    amount,
    procurement_type,
    threshold_id,
    last_transition_reason
)
VALUES (
    @p_entity_type,
    @p_entity_id,
    @p_stage_key,
    @p_status,
    @p_record_title,
    @p_parent_entity_type,
    @p_parent_entity_id,
    @p_amount,
    @p_procurement_type,
    @p_threshold_id,
    @p_transition_reason
)
RETURNING instance_id;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        AddSyncParameters(cmd, request);
        var result = await cmd.ExecuteScalarAsync(ct);
        var instanceId = result is Guid value ? value : Guid.Empty;

        if (instanceId == Guid.Empty)
        {
            throw new InvalidOperationException("Workflow instance creation failed.");
        }

        _logger.LogDebug("Created workflow runtime instance for {EntityType} {EntityId} at stage {StageKey}.", request.EntityType, request.EntityId, request.StageKey);
        return instanceId;
    }

    private async Task UpdateInstanceAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid instanceId,
        WorkflowRuntimeSyncRequest request,
        CancellationToken ct)
    {
        const string sql = @"
UPDATE procurement_workflow.workflow_instances
SET
    current_stage_key = @p_stage_key,
    current_status = @p_status,
    record_title = @p_record_title,
    parent_entity_type = @p_parent_entity_type,
    parent_entity_id = @p_parent_entity_id,
    amount = @p_amount,
    procurement_type = @p_procurement_type,
    threshold_id = @p_threshold_id,
    last_transition_reason = @p_transition_reason,
    updated_at = CURRENT_TIMESTAMP
WHERE instance_id = @p_instance_id;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        AddSyncParameters(cmd, request);
        cmd.Parameters.AddWithValue("p_instance_id", NpgsqlDbType.Uuid, instanceId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task InsertHistoryAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid instanceId,
        string? fromStageKey,
        WorkflowRuntimeSyncRequest request,
        CancellationToken ct)
    {
        const string sql = @"
INSERT INTO procurement_workflow.workflow_instance_history (
    instance_id,
    from_stage_key,
    to_stage_key,
    stage_status,
    transition_source,
    transition_reason,
    actor
)
VALUES (
    @p_instance_id,
    @p_from_stage_key,
    @p_to_stage_key,
    @p_stage_status,
    @p_transition_source,
    @p_transition_reason,
    @p_actor
);";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_instance_id", NpgsqlDbType.Uuid, instanceId);
        cmd.Parameters.AddWithValue("p_from_stage_key", NpgsqlDbType.Varchar, (object?)fromStageKey ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_to_stage_key", NpgsqlDbType.Varchar, request.StageKey);
        cmd.Parameters.AddWithValue("p_stage_status", NpgsqlDbType.Varchar, (object?)request.Status ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_transition_source", NpgsqlDbType.Varchar, request.TransitionSource);
        cmd.Parameters.AddWithValue("p_transition_reason", NpgsqlDbType.Text, (object?)request.TransitionReason ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_actor", NpgsqlDbType.Varchar, (object?)request.Actor ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static void AddSyncParameters(NpgsqlCommand cmd, WorkflowRuntimeSyncRequest request)
    {
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, request.EntityType);
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, request.EntityId);
        cmd.Parameters.AddWithValue("p_stage_key", NpgsqlDbType.Varchar, request.StageKey);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)request.Status ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_record_title", NpgsqlDbType.Varchar, (object?)request.RecordTitle ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_parent_entity_type", NpgsqlDbType.Varchar, (object?)request.ParentEntityType ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_parent_entity_id", NpgsqlDbType.Uuid, (object?)request.ParentEntityId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_amount", NpgsqlDbType.Numeric, (object?)request.Amount ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_procurement_type", NpgsqlDbType.Varchar, (object?)request.ProcurementType ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_threshold_id", NpgsqlDbType.Uuid, (object?)request.ThresholdId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_transition_reason", NpgsqlDbType.Text, (object?)request.TransitionReason ?? DBNull.Value);
    }

    private static string? GetNullableString(NpgsqlDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    private static Guid? GetNullableGuid(NpgsqlDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetGuid(ordinal);
    }

    private static decimal? GetNullableDecimal(NpgsqlDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetFieldValue<decimal>(ordinal);
    }

    private sealed record CurrentInstanceState(Guid InstanceId, string CurrentStageKey, string? CurrentStatus);
}

using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Shared.Workflow;

public sealed record WorkflowRuntimeSyncRequest(
    string EntityType,
    Guid EntityId,
    string StageKey,
    string? Status,
    string? RecordTitle,
    string? ParentEntityType,
    Guid? ParentEntityId,
    decimal? Amount,
    string? ProcurementType,
    Guid? ThresholdId,
    string? TransitionReason,
    string? Actor,
    string TransitionSource = "controller_sync");

public sealed record WorkflowRuntimeTransitionSummary(
    string ToStageKey,
    string StageTitle,
    string TransitionCondition);

public sealed record WorkflowRuntimeSnapshot(
    Guid InstanceId,
    string EntityType,
    Guid EntityId,
    string CurrentStageKey,
    string CurrentStageTitle,
    string CurrentPhaseKey,
    string? CurrentStatus,
    string? RecordTitle,
    string? ParentEntityType,
    Guid? ParentEntityId,
    decimal? Amount,
    string? ProcurementType,
    Guid? ThresholdId,
    string? LastTransitionReason,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<WorkflowRuntimeTransitionSummary> NextTransitions);

public sealed record WorkflowRuntimeHistoryEntry(
    Guid HistoryId,
    string? FromStageKey,
    string ToStageKey,
    string ToStageTitle,
    string? StageStatus,
    string TransitionSource,
    string? TransitionReason,
    string? Actor,
    DateTime CreatedAt);

public sealed class WorkflowRuntimeTracker
{
    private readonly ILogger<WorkflowRuntimeTracker> _logger;

    public WorkflowRuntimeTracker(ILogger<WorkflowRuntimeTracker> logger)
    {
        _logger = logger;
    }

    public async Task SyncAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        WorkflowRuntimeSyncRequest request,
        CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(conn);
        ArgumentNullException.ThrowIfNull(tx);

        var normalizedRequest = Normalize(request);
        var existing = await GetCurrentInstanceAsync(conn, tx, normalizedRequest.EntityType, normalizedRequest.EntityId, ct);

        if (existing is null)
        {
            var instanceId = await InsertInstanceAsync(conn, tx, normalizedRequest, ct);
            await InsertHistoryAsync(conn, tx, instanceId, null, normalizedRequest, ct);
            return;
        }

        var stageChanged = !string.Equals(existing.CurrentStageKey, normalizedRequest.StageKey, StringComparison.OrdinalIgnoreCase);
        var statusChanged = !string.Equals(existing.CurrentStatus, normalizedRequest.Status, StringComparison.OrdinalIgnoreCase);

        await UpdateInstanceAsync(conn, tx, existing.InstanceId, normalizedRequest, ct);

        if (stageChanged || statusChanged)
        {
            await InsertHistoryAsync(conn, tx, existing.InstanceId, existing.CurrentStageKey, normalizedRequest, ct);
        }
    }

    public async Task<WorkflowRuntimeSnapshot?> GetAsync(
        string connectionString,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return null;
        }

        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);

        const string snapshotSql = @"
SELECT
    wi.instance_id,
    wi.entity_type,
    wi.entity_id,
    wi.current_stage_key,
    sc.stage_title,
    sc.phase_key,
    wi.current_status,
    wi.record_title,
    wi.parent_entity_type,
    wi.parent_entity_id,
    wi.amount,
    wi.procurement_type,
    wi.threshold_id,
    wi.last_transition_reason,
    wi.created_at,
    wi.updated_at
FROM procurement_workflow.workflow_instances wi
JOIN procurement_workflow.workflow_stage_catalog sc
    ON sc.stage_key = wi.current_stage_key
WHERE wi.entity_type = @p_entity_type
  AND wi.entity_id = @p_entity_id;";

        await using var cmd = new NpgsqlCommand(snapshotSql, conn);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, NormalizeEntityType(entityType));
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        var currentStageKey = reader.GetString(reader.GetOrdinal("current_stage_key"));
        var snapshot = new WorkflowRuntimeSnapshot(
            reader.GetGuid(reader.GetOrdinal("instance_id")),
            reader.GetString(reader.GetOrdinal("entity_type")),
            reader.GetGuid(reader.GetOrdinal("entity_id")),
            currentStageKey,
            reader.GetString(reader.GetOrdinal("stage_title")),
            reader.GetString(reader.GetOrdinal("phase_key")),
            GetNullableString(reader, "current_status"),
            GetNullableString(reader, "record_title"),
            GetNullableString(reader, "parent_entity_type"),
            GetNullableGuid(reader, "parent_entity_id"),
            GetNullableDecimal(reader, "amount"),
            GetNullableString(reader, "procurement_type"),
            GetNullableGuid(reader, "threshold_id"),
            GetNullableString(reader, "last_transition_reason"),
            reader.GetDateTime(reader.GetOrdinal("created_at")),
            reader.GetDateTime(reader.GetOrdinal("updated_at")),
            Array.Empty<WorkflowRuntimeTransitionSummary>());

        await reader.CloseAsync();
        var nextTransitions = await GetTransitionsAsync(conn, currentStageKey, ct);
        return snapshot with { NextTransitions = nextTransitions };
    }

    public async Task<IReadOnlyList<WorkflowRuntimeHistoryEntry>> GetHistoryAsync(
        string connectionString,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Array.Empty<WorkflowRuntimeHistoryEntry>();
        }

        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);

        const string sql = @"
SELECT
    h.history_id,
    h.from_stage_key,
    h.to_stage_key,
    sc.stage_title,
    h.stage_status,
    h.transition_source,
    h.transition_reason,
    h.actor,
    h.created_at
FROM procurement_workflow.workflow_instance_history h
JOIN procurement_workflow.workflow_instances wi
    ON wi.instance_id = h.instance_id
JOIN procurement_workflow.workflow_stage_catalog sc
    ON sc.stage_key = h.to_stage_key
WHERE wi.entity_type = @p_entity_type
  AND wi.entity_id = @p_entity_id
ORDER BY h.created_at DESC;";

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, NormalizeEntityType(entityType));
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);

        var entries = new List<WorkflowRuntimeHistoryEntry>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            entries.Add(new WorkflowRuntimeHistoryEntry(
                reader.GetGuid(reader.GetOrdinal("history_id")),
                GetNullableString(reader, "from_stage_key"),
                reader.GetString(reader.GetOrdinal("to_stage_key")),
                reader.GetString(reader.GetOrdinal("stage_title")),
                GetNullableString(reader, "stage_status"),
                reader.GetString(reader.GetOrdinal("transition_source")),
                GetNullableString(reader, "transition_reason"),
                GetNullableString(reader, "actor"),
                reader.GetDateTime(reader.GetOrdinal("created_at"))));
        }

        return entries;
    }

    private static WorkflowRuntimeSyncRequest Normalize(WorkflowRuntimeSyncRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        return request with
        {
            EntityType = NormalizeEntityType(request.EntityType),
            StageKey = request.StageKey.Trim(),
            Status = NormalizeNullable(request.Status),
            RecordTitle = NormalizeNullable(request.RecordTitle),
            ParentEntityType = NormalizeNullable(request.ParentEntityType),
            ProcurementType = NormalizeNullable(request.ProcurementType),
            TransitionReason = NormalizeNullable(request.TransitionReason),
            Actor = NormalizeNullable(request.Actor),
            TransitionSource = string.IsNullOrWhiteSpace(request.TransitionSource)
                ? "controller_sync"
                : request.TransitionSource.Trim()
        };
    }

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

    private static async Task<IReadOnlyList<WorkflowRuntimeTransitionSummary>> GetTransitionsAsync(
        NpgsqlConnection conn,
        string stageKey,
        CancellationToken ct)
    {
        const string sql = @"
SELECT
    t.to_stage_key,
    sc.stage_title,
    t.transition_condition
FROM procurement_workflow.workflow_stage_transitions t
JOIN procurement_workflow.workflow_stage_catalog sc
    ON sc.stage_key = t.to_stage_key
WHERE t.from_stage_key = @p_stage_key
ORDER BY sc.sequence_no;";

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_stage_key", NpgsqlDbType.Varchar, stageKey);

        var results = new List<WorkflowRuntimeTransitionSummary>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(new WorkflowRuntimeTransitionSummary(
                reader.GetString(reader.GetOrdinal("to_stage_key")),
                reader.GetString(reader.GetOrdinal("stage_title")),
                reader.GetString(reader.GetOrdinal("transition_condition"))));
        }

        return results;
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

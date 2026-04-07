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

public sealed record CgisQueueItem(
    Guid InstanceId,
    string EntityType,
    Guid EntityId,
    string? RecordTitle,
    string? Department,
    decimal? Amount,
    string? ApprovalRoute,
    string? ApprovalAuthorityLabel,
    string? Status,
    string? VendorName,
    DateTime CreatedAt,
    int DaysPending);

public sealed record CgisDocument(
    string DocumentType,
    string? FileName,
    string? FileUrl,
    string? Status,
    DateTime? UpdatedAt);

public sealed partial class WorkflowRuntimeTracker
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

}

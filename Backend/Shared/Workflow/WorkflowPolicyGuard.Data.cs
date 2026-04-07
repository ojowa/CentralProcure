using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Shared.Workflow;

public sealed partial class WorkflowPolicyGuard
{
    private static string NormalizeRequired(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Value is required.", paramName);
        }

        return value.Trim().ToLowerInvariant();
    }

    private static string? NormalizeNullable(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static async Task<StageState?> GetCurrentStageAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT wi.current_stage_key, sc.stage_title
FROM procurement_workflow.workflow_instances wi
JOIN procurement_workflow.workflow_stage_catalog sc
    ON sc.stage_key = wi.current_stage_key
WHERE wi.entity_type = @p_entity_type
  AND wi.entity_id = @p_entity_id;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, entityType);
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new StageState(
            reader.GetString(reader.GetOrdinal("current_stage_key")),
            reader.GetString(reader.GetOrdinal("stage_title")));
    }

    private static async Task<string?> GetStageTitleAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string stageKey,
        CancellationToken ct)
    {
        const string sql = @"
SELECT stage_title
FROM procurement_workflow.workflow_stage_catalog
WHERE stage_key = @p_stage_key;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_stage_key", NpgsqlDbType.Varchar, stageKey);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result as string;
    }

    private static async Task<bool> IsReachableAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string fromStageKey,
        string toStageKey,
        CancellationToken ct)
    {
        const string sql = @"
WITH RECURSIVE reachable(stage_key, path) AS (
    SELECT @p_from_stage_key::varchar, ARRAY[@p_from_stage_key::varchar]
    UNION ALL
    SELECT t.to_stage_key, r.path || t.to_stage_key
    FROM reachable r
    JOIN procurement_workflow.workflow_stage_transitions t
        ON t.from_stage_key = r.stage_key
    WHERE NOT t.to_stage_key = ANY(r.path)
)
SELECT 1
FROM reachable
WHERE stage_key = @p_to_stage_key
LIMIT 1;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_from_stage_key", NpgsqlDbType.Varchar, fromStageKey);
        cmd.Parameters.AddWithValue("p_to_stage_key", NpgsqlDbType.Varchar, toStageKey);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is not null;
    }

    private static async Task<WorkflowInstanceState?> GetCurrentInstanceAsync(
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
    threshold_id,
    amount,
    procurement_type
FROM procurement_workflow.workflow_instances
WHERE entity_type = @p_entity_type
  AND entity_id = @p_entity_id;";

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
            reader.IsDBNull(reader.GetOrdinal("threshold_id")) ? null : reader.GetGuid(reader.GetOrdinal("threshold_id")),
            reader.IsDBNull(reader.GetOrdinal("amount")) ? null : reader.GetFieldValue<decimal>(reader.GetOrdinal("amount")),
            reader.IsDBNull(reader.GetOrdinal("procurement_type")) ? null : reader.GetString(reader.GetOrdinal("procurement_type")));
    }

    private static async Task<WorkflowThresholdResolution?> GetThresholdByIdAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid thresholdId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT
    threshold_id,
    approval_route,
    approval_authority_code,
    approval_authority_label,
    requires_cgis_approval,
    requires_board,
    requires_bpp,
    governance_body_id,
    body.body_name AS governance_body_name,
    min_amount,
    max_amount,
    notes
FROM procurement_workflow.approval_thresholds
LEFT JOIN procurement_workflow.governance_bodies body
    ON body.body_id = procurement_workflow.approval_thresholds.governance_body_id
WHERE threshold_id = @p_threshold_id;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_threshold_id", NpgsqlDbType.Uuid, thresholdId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new WorkflowThresholdResolution(
            reader.GetGuid(reader.GetOrdinal("threshold_id")),
            reader.GetString(reader.GetOrdinal("approval_route")),
            reader.GetString(reader.GetOrdinal("approval_authority_code")),
            reader.GetString(reader.GetOrdinal("approval_authority_label")),
            reader.GetBoolean(reader.GetOrdinal("requires_cgis_approval")),
            reader.GetBoolean(reader.GetOrdinal("requires_board")),
            reader.GetBoolean(reader.GetOrdinal("requires_bpp")),
            reader.IsDBNull(reader.GetOrdinal("governance_body_id")) ? null : reader.GetGuid(reader.GetOrdinal("governance_body_id")),
            reader.IsDBNull(reader.GetOrdinal("governance_body_name")) ? null : reader.GetString(reader.GetOrdinal("governance_body_name")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("min_amount")),
            reader.IsDBNull(reader.GetOrdinal("max_amount")) ? null : reader.GetFieldValue<decimal>(reader.GetOrdinal("max_amount")),
            reader.IsDBNull(reader.GetOrdinal("notes")) ? null : reader.GetString(reader.GetOrdinal("notes")));
    }

    private sealed record StageState(string StageKey, string StageTitle);

    private sealed record WorkflowInstanceState(
        string EntityType,
        Guid EntityId,
        string CurrentStageKey,
        Guid? ThresholdId,
        decimal? Amount,
        string? ProcurementType);
}

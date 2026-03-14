using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Shared.Workflow;

public sealed record WorkflowThresholdResolution(
    Guid ThresholdId,
    string ApprovalRoute,
    bool RequiresBoard,
    bool RequiresBpp,
    decimal MinAmount,
    decimal? MaxAmount,
    string? Notes);

public sealed record WorkflowTransitionCheckResult(
    bool IsAllowed,
    string? CurrentStageKey,
    string? CurrentStageTitle,
    string RequestedStageKey,
    string? RequestedStageTitle,
    string? Message);

public sealed record WorkflowRouteDecision(
    string EntityType,
    Guid EntityId,
    string CurrentStageKey,
    Guid? ThresholdId,
    string? ApprovalRoute,
    bool RequiresBoard,
    bool RequiresBpp,
    decimal? Amount,
    string? ProcurementType,
    string? Notes);

public sealed class WorkflowPolicyGuard
{
    public async Task<WorkflowTransitionCheckResult> EvaluateTransitionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        string requestedStageKey,
        CancellationToken ct)
    {
        var normalizedEntityType = NormalizeRequired(entityType, nameof(entityType));
        var normalizedRequestedStageKey = NormalizeRequired(requestedStageKey, nameof(requestedStageKey));

        var current = await GetCurrentStageAsync(conn, tx, normalizedEntityType, entityId, ct);
        var requestedTitle = await GetStageTitleAsync(conn, tx, normalizedRequestedStageKey, ct);

        if (requestedTitle is null)
        {
            return new WorkflowTransitionCheckResult(
                false,
                current?.StageKey,
                current?.StageTitle,
                normalizedRequestedStageKey,
                null,
                $"Workflow stage '{normalizedRequestedStageKey}' is not defined.");
        }

        if (current is null)
        {
            return new WorkflowTransitionCheckResult(
                true,
                null,
                null,
                normalizedRequestedStageKey,
                requestedTitle,
                null);
        }

        if (string.Equals(current.StageKey, normalizedRequestedStageKey, StringComparison.OrdinalIgnoreCase))
        {
            return new WorkflowTransitionCheckResult(
                true,
                current.StageKey,
                current.StageTitle,
                normalizedRequestedStageKey,
                requestedTitle,
                null);
        }

        var isReachable = await IsReachableAsync(conn, tx, current.StageKey, normalizedRequestedStageKey, ct);
        if (isReachable)
        {
            var routeConstraintError = await EvaluateRouteConstraintAsync(
                conn,
                tx,
                normalizedEntityType,
                entityId,
                current.StageKey,
                normalizedRequestedStageKey,
                ct);

            if (routeConstraintError is not null)
            {
                return new WorkflowTransitionCheckResult(
                    false,
                    current.StageKey,
                    current.StageTitle,
                    normalizedRequestedStageKey,
                    requestedTitle,
                    routeConstraintError);
            }
        }

        return isReachable
            ? new WorkflowTransitionCheckResult(
                true,
                current.StageKey,
                current.StageTitle,
                normalizedRequestedStageKey,
                requestedTitle,
                null)
            : new WorkflowTransitionCheckResult(
                false,
                current.StageKey,
                current.StageTitle,
                normalizedRequestedStageKey,
                requestedTitle,
                $"Illegal workflow transition from '{current.StageTitle}' to '{requestedTitle}'.");
    }

    public async Task<WorkflowRouteDecision?> ResolveRouteDecisionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        var normalizedEntityType = NormalizeRequired(entityType, nameof(entityType));
        var current = await GetCurrentInstanceAsync(conn, tx, normalizedEntityType, entityId, ct);
        if (current is null)
        {
            return null;
        }

        WorkflowThresholdResolution? threshold = null;
        if (current.ThresholdId.HasValue)
        {
            threshold = await GetThresholdByIdAsync(conn, tx, current.ThresholdId.Value, ct);
        }

        threshold ??= await ResolveThresholdAsync(conn, tx, current.ProcurementType, current.Amount, ct);

        return new WorkflowRouteDecision(
            current.EntityType,
            current.EntityId,
            current.CurrentStageKey,
            threshold?.ThresholdId ?? current.ThresholdId,
            threshold?.ApprovalRoute,
            threshold?.RequiresBoard ?? false,
            threshold?.RequiresBpp ?? false,
            current.Amount,
            current.ProcurementType,
            threshold?.Notes);
    }

    public async Task<WorkflowThresholdResolution?> ResolveThresholdAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string? procurementType,
        decimal? amount,
        CancellationToken ct)
    {
        if (!amount.HasValue)
        {
            return null;
        }

        const string sql = @"
SELECT
    threshold_id,
    approval_route,
    requires_board,
    requires_bpp,
    min_amount,
    max_amount,
    notes
FROM procurement_workflow.get_threshold_for_amount(@p_procurement_type, @p_amount);";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_procurement_type", NpgsqlDbType.Varchar, (object?)NormalizeNullable(procurementType) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_amount", NpgsqlDbType.Numeric, amount.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new WorkflowThresholdResolution(
            reader.GetGuid(reader.GetOrdinal("threshold_id")),
            reader.GetString(reader.GetOrdinal("approval_route")),
            reader.GetBoolean(reader.GetOrdinal("requires_board")),
            reader.GetBoolean(reader.GetOrdinal("requires_bpp")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("min_amount")),
            reader.IsDBNull(reader.GetOrdinal("max_amount")) ? null : reader.GetFieldValue<decimal>(reader.GetOrdinal("max_amount")),
            reader.IsDBNull(reader.GetOrdinal("notes")) ? null : reader.GetString(reader.GetOrdinal("notes")));
    }

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

    private async Task<string?> EvaluateRouteConstraintAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        string currentStageKey,
        string requestedStageKey,
        CancellationToken ct)
    {
        var decision = await ResolveRouteDecisionAsync(conn, tx, entityType, entityId, ct);
        if (decision is null)
        {
            return null;
        }

        if (string.Equals(currentStageKey, "tenders_board_review", StringComparison.OrdinalIgnoreCase))
        {
            if (string.Equals(requestedStageKey, "accounting_officer_review", StringComparison.OrdinalIgnoreCase) &&
                !RequiresAccountingOfficerReview(decision))
            {
                return "The live threshold route does not require Accounting Officer review for this record.";
            }

            if (string.Equals(requestedStageKey, "award_and_publication", StringComparison.OrdinalIgnoreCase) &&
                RequiresAccountingOfficerReview(decision))
            {
                return "The live threshold route requires Accounting Officer review before award publication.";
            }
        }

        if (string.Equals(currentStageKey, "accounting_officer_review", StringComparison.OrdinalIgnoreCase))
        {
            if (string.Equals(requestedStageKey, "bpp_no_objection", StringComparison.OrdinalIgnoreCase) &&
                !decision.RequiresBpp)
            {
                return "The live threshold route does not require BPP no-objection for this record.";
            }

            if (string.Equals(requestedStageKey, "award_and_publication", StringComparison.OrdinalIgnoreCase) &&
                decision.RequiresBpp)
            {
                return "The live threshold route requires BPP no-objection before award publication.";
            }
        }

        return null;
    }

    private static bool RequiresAccountingOfficerReview(WorkflowRouteDecision decision)
    {
        if (decision.RequiresBpp)
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(decision.ApprovalRoute))
        {
            return false;
        }

        var route = decision.ApprovalRoute.Trim().ToLowerInvariant();
        return route.Contains("accounting") || route.Contains("officer") || route.Contains("ao");
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
    requires_board,
    requires_bpp,
    min_amount,
    max_amount,
    notes
FROM procurement_workflow.approval_thresholds
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
            reader.GetBoolean(reader.GetOrdinal("requires_board")),
            reader.GetBoolean(reader.GetOrdinal("requires_bpp")),
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

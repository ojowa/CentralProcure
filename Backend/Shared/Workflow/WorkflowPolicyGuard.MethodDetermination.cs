using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Shared.Workflow;

public sealed partial class WorkflowPolicyGuard
{
    private static readonly HashSet<string> MethodDecisionRequiredStages = new(StringComparer.OrdinalIgnoreCase)
    {
        "solicitation",
        "bid_opening",
        "evaluation",
        "accounting_officer_review",
        "award_and_publication"
    };

    private static async Task<string?> EvaluateMethodDeterminationRequirementAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        string requestedStageKey,
        CancellationToken ct)
    {
        if (!string.Equals(entityType, "tender", StringComparison.OrdinalIgnoreCase) ||
            !MethodDecisionRequiredStages.Contains(requestedStageKey))
        {
            return null;
        }

        var routeDecision = await ResolveMethodRouteDecisionAsync(conn, tx, entityType, entityId, ct);
        if (routeDecision is null || !routeDecision.RequiresCgisApproval)
        {
            return null;
        }

        var currentMethod = await GetCurrentMethodDecisionAsync(conn, tx, entityType, entityId, ct);
        if (currentMethod is null)
        {
            return "A procurement method must be recorded by Comptroller Procurement before this low-value case can proceed.";
        }

        if (string.Equals(currentMethod, "SimplifiedQuotation", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(requestedStageKey, "bid_opening", StringComparison.OrdinalIgnoreCase))
        {
            return "Simplified quotation cases cannot move to bid opening. Proceed from solicitation to comparative review/evaluation instead.";
        }

        return null;
    }

    private static async Task<WorkflowRouteDecision?> ResolveMethodRouteDecisionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        var current = await GetCurrentInstanceAsync(conn, tx, entityType, entityId, ct);
        if (current is null)
        {
            return null;
        }

        WorkflowThresholdResolution? threshold = null;
        if (current.ThresholdId.HasValue)
        {
            threshold = await GetThresholdByIdAsync(conn, tx, current.ThresholdId.Value, ct);
        }

        threshold ??= await ResolveThresholdStaticAsync(conn, tx, current.ProcurementType, current.Amount, ct);

        return new WorkflowRouteDecision(
            current.EntityType,
            current.EntityId,
            current.CurrentStageKey,
            threshold?.ThresholdId ?? current.ThresholdId,
            threshold?.ApprovalRoute,
            threshold?.ApprovalAuthorityCode,
            threshold?.ApprovalAuthorityLabel,
            threshold?.RequiresCgisApproval ?? false,
            threshold?.RequiresBoard ?? false,
            threshold?.RequiresBpp ?? false,
            threshold?.GovernanceBodyId,
            threshold?.GovernanceBodyName,
            current.Amount,
            current.ProcurementType,
            threshold?.Notes);
    }

    private static async Task<string?> GetCurrentMethodDecisionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT selected_method
FROM procurement_workflow.procurement_method_decisions
WHERE entity_type = @p_entity_type
  AND entity_id = @p_entity_id
  AND superseded_by_decision_id IS NULL
ORDER BY determined_at DESC
LIMIT 1;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, entityType);
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result as string;
    }

    private static async Task<WorkflowThresholdResolution?> ResolveThresholdStaticAsync(
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
WHERE status = 'Active'
  AND min_amount <= @p_amount
  AND (max_amount IS NULL OR max_amount >= @p_amount)
  AND (
        @p_procurement_type IS NULL
        OR procurement_type IS NULL
        OR lower(procurement_type) = lower(@p_procurement_type)
      )
ORDER BY
    CASE
        WHEN @p_procurement_type IS NOT NULL AND procurement_type IS NOT NULL AND lower(procurement_type) = lower(@p_procurement_type) THEN 0
        WHEN procurement_type IS NULL THEN 1
        ELSE 2
    END,
    min_amount DESC
LIMIT 1;";

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
}

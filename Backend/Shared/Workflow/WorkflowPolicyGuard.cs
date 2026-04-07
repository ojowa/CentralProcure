using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Shared.Workflow;

public sealed record WorkflowThresholdResolution(
    Guid ThresholdId,
    string ApprovalRoute,
    string ApprovalAuthorityCode,
    string ApprovalAuthorityLabel,
    bool RequiresCgisApproval,
    bool RequiresBoard,
    bool RequiresBpp,
    Guid? GovernanceBodyId,
    string? GovernanceBodyName,
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
    string? ApprovalAuthorityCode,
    string? ApprovalAuthorityLabel,
    bool RequiresCgisApproval,
    bool RequiresBoard,
    bool RequiresBpp,
    Guid? GovernanceBodyId,
    string? GovernanceBodyName,
    decimal? Amount,
    string? ProcurementType,
    string? Notes);

public sealed partial class WorkflowPolicyGuard
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

        var exceptionPauseMessage = await EvaluateMethodExceptionPauseAsync(
            conn,
            tx,
            normalizedEntityType,
            entityId,
            current.StageKey,
            normalizedRequestedStageKey,
            ct);

        if (exceptionPauseMessage is not null)
        {
            return new WorkflowTransitionCheckResult(
                false,
                current.StageKey,
                current.StageTitle,
                normalizedRequestedStageKey,
                requestedTitle,
                exceptionPauseMessage);
        }

        var methodDecisionError = await EvaluateMethodDeterminationRequirementAsync(
            conn,
            tx,
            normalizedEntityType,
            entityId,
            normalizedRequestedStageKey,
            ct);

        if (methodDecisionError is not null)
        {
            return new WorkflowTransitionCheckResult(
                false,
                current.StageKey,
                current.StageTitle,
                normalizedRequestedStageKey,
                requestedTitle,
                methodDecisionError);
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
            if (string.Equals(requestedStageKey, "accounting_officer_review", StringComparison.OrdinalIgnoreCase))
            {
                return "CGIS approval applies only to low-value routes and cannot follow Tenders Board review.";
            }

            if (string.Equals(requestedStageKey, "award_and_publication", StringComparison.OrdinalIgnoreCase) &&
                decision.RequiresBpp)
            {
                return "The live threshold route requires BPP no-objection before award publication.";
            }

            if (string.Equals(requestedStageKey, "bpp_no_objection", StringComparison.OrdinalIgnoreCase) &&
                !decision.RequiresBpp)
            {
                return "The live threshold route does not require BPP no-objection for this record.";
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

        if (string.Equals(currentStageKey, "evaluation", StringComparison.OrdinalIgnoreCase))
        {
            if (string.Equals(requestedStageKey, "accounting_officer_review", StringComparison.OrdinalIgnoreCase) &&
                !decision.RequiresCgisApproval)
            {
                return "The live threshold route does not require CGIS approval for this record.";
            }

            if (string.Equals(requestedStageKey, "tenders_board_review", StringComparison.OrdinalIgnoreCase) &&
                !decision.RequiresBoard)
            {
                return "The live threshold route does not require Tenders Board review for this record.";
            }
        }

        return null;
    }
}

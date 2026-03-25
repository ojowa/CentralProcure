using System.Security.Claims;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/procurement-plans")]
public class ProcurementPlanRecommendationsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<ProcurementPlanRecommendationsController> _logger;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

    public ProcurementPlanRecommendationsController(
        IConfiguration config,
        ILogger<ProcurementPlanRecommendationsController> logger,
        WorkflowRuntimeTracker workflowRuntimeTracker)
    {
        _config = config;
        _logger = logger;
        _workflowRuntimeTracker = workflowRuntimeTracker;
    }

    [HttpGet("{planId:guid}/recommendation-readiness")]
    public async Task<IActionResult> GetRecommendationReadiness(Guid planId, CancellationToken ct)
    {
        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var plan = await GetPlanAsync(conn, tx, planId, ct);
            if (plan is null)
            {
                return NotFound();
            }

            var readiness = await ValidateRecommendationReadinessAsync(conn, tx, planId, ct);
            await tx.CommitAsync(ct);
            return Ok(new ProcurementPlanRecommendationReadinessResponse(
                planId,
                readiness.TotalTrackedRequisitions,
                readiness.RecommendedRequisitions,
                readiness.PendingFinalDecisionRequisitions,
                readiness.NonRecommendedRequisitions,
                readiness.AppItemCount,
                readiness.IsReady,
                readiness.Message ?? "APP is ready to be recommended for approval.",
                readiness.Requisitions));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving APP recommendation readiness for plan {PlanId}.", planId);
            return Problem("Internal server error retrieving APP recommendation readiness.");
        }
    }

    [HttpPost("{planId:guid}/recommend-for-approval")]
    public async Task<IActionResult> RecommendForApproval(Guid planId, [FromBody] ProcurementPlanRecommendationRequest? request, CancellationToken ct)
    {
        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        if (!string.Equals(roleKey, "procurement_secretary", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(roleKey, "admin", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var plan = await GetPlanAsync(conn, tx, planId, ct);
            if (plan is null)
            {
                return NotFound();
            }

            if (!string.Equals(plan.CurrentStageKey, "planning_committee_review", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest("APP is not currently at planning committee review.");
            }

            var ready = await ValidateRecommendationReadinessAsync(conn, tx, planId, ct);
            if (!ready.IsReady)
            {
                return BadRequest(ready.Message);
            }

            var actor = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name ?? "system";
            var userNote = string.IsNullOrWhiteSpace(request?.Note) ? null : request.Note.Trim();
            var utcNow = DateTime.UtcNow;
            var submittedAt = DateTime.SpecifyKind(utcNow, DateTimeKind.Unspecified);
            var note = $"[{utcNow:yyyy-MM-dd HH:mm:ss 'UTC'}] APP recommended by Procurement Secretary for Comptroller Procurement approval. (actor: {actor})";
            if (!string.IsNullOrWhiteSpace(userNote))
            {
                note = $"{note}{Environment.NewLine}Recommendation Note: {userNote}";
            }

            await UpdatePlanAsync(conn, tx, planId, note, submittedAt, ct);
            await _workflowRuntimeTracker.SyncAsync(
                conn,
                tx,
                new WorkflowRuntimeSyncRequest(
                    "procurement_plan",
                    planId,
                    "app_approval",
                    "Submitted",
                    plan.PlanTitle,
                    null,
                    null,
                    plan.TotalBudget,
                    null,
                    null,
                    note,
                    actor,
                    "app_recommended_for_approval"),
                ct);

            await tx.CommitAsync(ct);

            return Ok(new ProcurementPlanRecommendationResponse(
                planId,
                "APP recommended to Comptroller Procurement for approval.",
                "app_approval",
                "APP Approval",
                "Submitted",
                "Submitted",
                submittedAt));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recommending APP {PlanId} for approval.", planId);
            return Problem($"Internal server error recommending APP for approval. {ex.Message}");
        }
    }

    private static async Task<PlanRecommendationSummary?> GetPlanAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid planId, CancellationToken ct)
    {
        const string sql = """
SELECT p.plan_id, p.plan_title, p.status, p.total_budget, wi.current_stage_key
FROM procurement_workflow.procurement_plans p
LEFT JOIN procurement_workflow.workflow_instances wi
  ON wi.entity_type = 'procurement_plan'
 AND wi.entity_id = p.plan_id
WHERE p.plan_id = @p_plan_id;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new PlanRecommendationSummary(
            reader.GetGuid(reader.GetOrdinal("plan_id")),
            reader.GetString(reader.GetOrdinal("plan_title")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.GetDecimal(reader.GetOrdinal("total_budget")),
            reader.IsDBNull(reader.GetOrdinal("current_stage_key")) ? null : reader.GetString(reader.GetOrdinal("current_stage_key")));
    }

    private static async Task<RecommendationReadiness> ValidateRecommendationReadinessAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid planId, CancellationToken ct)
    {
        const string summarySql = """
WITH tracked_requisitions AS (
    SELECT requisition_id
    FROM procurement_workflow.planning_committee_plan_links
    WHERE plan_id = @p_plan_id
    UNION
    SELECT requisition_id
    FROM procurement_workflow.planning_committee_decisions
    WHERE plan_id = @p_plan_id
),
decision_rollup AS (
    SELECT
        tr.requisition_id,
        d.overall_decision,
        r.app_item_id
    FROM tracked_requisitions tr
    LEFT JOIN procurement_workflow.planning_committee_decisions d
      ON d.plan_id = @p_plan_id
     AND d.requisition_id = tr.requisition_id
    LEFT JOIN procurement_workflow.requisitions r
      ON r.requisition_id = tr.requisition_id
)
SELECT
    (SELECT COUNT(*)::int FROM tracked_requisitions) AS total_tracked_requisitions,
    COALESCE(SUM(CASE WHEN overall_decision = 'Recommended' THEN 1 ELSE 0 END), 0)::int AS recommended_requisitions,
    COALESCE(SUM(CASE WHEN overall_decision IS NULL THEN 1 ELSE 0 END), 0)::int AS pending_final_decision_requisitions,
    COALESCE(SUM(CASE WHEN overall_decision IS NOT NULL AND overall_decision <> 'Recommended' THEN 1 ELSE 0 END), 0)::int AS non_recommended_requisitions,
    COALESCE(SUM(CASE WHEN app_item_id IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS app_item_count
FROM decision_rollup;
""";
        await using var cmd = new NpgsqlCommand(summarySql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return new RecommendationReadiness(0, 0, 0, 0, 0, false, "Unable to validate APP recommendation readiness.", []);
        }

        var totalTrackedRequisitions = reader.GetInt32(reader.GetOrdinal("total_tracked_requisitions"));
        var recommendedRequisitions = reader.GetInt32(reader.GetOrdinal("recommended_requisitions"));
        var pendingFinalDecisionRequisitions = reader.GetInt32(reader.GetOrdinal("pending_final_decision_requisitions"));
        var nonRecommendedRequisitions = reader.GetInt32(reader.GetOrdinal("non_recommended_requisitions"));
        var appItemCount = reader.GetInt32(reader.GetOrdinal("app_item_count"));
        await reader.CloseAsync();
        var requisitions = await GetRecommendationRequisitionsAsync(conn, tx, planId, ct);
        if (totalTrackedRequisitions <= 0)
        {
            return new RecommendationReadiness(0, 0, 0, 0, appItemCount, false, "APP has no requisitions tied to planning committee review yet.", requisitions);
        }

        if (pendingFinalDecisionRequisitions > 0)
        {
            return new RecommendationReadiness(
                totalTrackedRequisitions,
                recommendedRequisitions,
                pendingFinalDecisionRequisitions,
                nonRecommendedRequisitions,
                appItemCount,
                false,
                "All requisitions tied to this APP must complete final planning committee decision before recommendation.",
                requisitions);
        }

        if (nonRecommendedRequisitions > 0)
        {
            return new RecommendationReadiness(
                totalTrackedRequisitions,
                recommendedRequisitions,
                pendingFinalDecisionRequisitions,
                nonRecommendedRequisitions,
                appItemCount,
                false,
                "APP cannot be recommended because one or more tied requisitions were returned or rejected by the planning committee.",
                requisitions);
        }

        if (recommendedRequisitions != totalTrackedRequisitions || appItemCount < recommendedRequisitions)
        {
            return new RecommendationReadiness(
                totalTrackedRequisitions,
                recommendedRequisitions,
                pendingFinalDecisionRequisitions,
                nonRecommendedRequisitions,
                appItemCount,
                false,
                "APP recommendation is blocked until every tied requisition has a final Recommended decision and corresponding APP item.",
                requisitions);
        }

        return new RecommendationReadiness(
            totalTrackedRequisitions,
            recommendedRequisitions,
            pendingFinalDecisionRequisitions,
            nonRecommendedRequisitions,
            appItemCount,
            true,
            null,
            requisitions);
    }

    private static async Task<IReadOnlyList<ProcurementPlanRecommendationRequisitionResponse>> GetRecommendationRequisitionsAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid planId,
        CancellationToken ct)
    {
        const string sql = """
WITH tracked_requisitions AS (
    SELECT requisition_id
    FROM procurement_workflow.planning_committee_plan_links
    WHERE plan_id = @p_plan_id
    UNION
    SELECT requisition_id
    FROM procurement_workflow.planning_committee_decisions
    WHERE plan_id = @p_plan_id
)
SELECT
    r.requisition_id,
    r.title,
    r.department,
    r.total_estimate,
    d.overall_decision,
    r.app_item_id
FROM tracked_requisitions tr
JOIN procurement_workflow.requisitions r
  ON r.requisition_id = tr.requisition_id
LEFT JOIN procurement_workflow.planning_committee_decisions d
  ON d.plan_id = @p_plan_id
 AND d.requisition_id = tr.requisition_id
ORDER BY r.created_at ASC, r.title ASC;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<ProcurementPlanRecommendationRequisitionResponse>();
        while (await reader.ReadAsync(ct))
        {
            var decision = reader.IsDBNull(reader.GetOrdinal("overall_decision")) ? null : reader.GetString(reader.GetOrdinal("overall_decision"));
            Guid? appItemId = reader.IsDBNull(reader.GetOrdinal("app_item_id")) ? null : reader.GetGuid(reader.GetOrdinal("app_item_id"));
            results.Add(new ProcurementPlanRecommendationRequisitionResponse(
                reader.GetGuid(reader.GetOrdinal("requisition_id")),
                reader.GetString(reader.GetOrdinal("title")),
                reader.GetString(reader.GetOrdinal("department")),
                reader.GetDecimal(reader.GetOrdinal("total_estimate")),
                decision,
                appItemId,
                string.Equals(decision, "Recommended", StringComparison.OrdinalIgnoreCase) && appItemId.HasValue));
        }

        return results;
    }

    private static async Task UpdatePlanAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid planId, string note, DateTime submittedAt, CancellationToken ct)
    {
        const string sql = """
UPDATE procurement_workflow.procurement_plans
SET status = 'Submitted',
    submitted_at = @p_submitted_at,
    notes = CASE
        WHEN NULLIF(BTRIM(notes), '') IS NULL THEN @p_note
        ELSE notes || E'\n\n' || @p_note
    END,
    updated_at = NOW()
WHERE plan_id = @p_plan_id;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        cmd.Parameters.AddWithValue("p_note", NpgsqlDbType.Text, note);
        cmd.Parameters.AddWithValue("p_submitted_at", NpgsqlDbType.Timestamp, submittedAt);
        if (await cmd.ExecuteNonQueryAsync(ct) == 0)
        {
            throw new InvalidOperationException("APP could not be updated for recommendation.");
        }
    }

    private sealed record PlanRecommendationSummary(
        Guid PlanId,
        string PlanTitle,
        string Status,
        decimal TotalBudget,
        string? CurrentStageKey);

    private sealed record RecommendationReadiness(
        int TotalTrackedRequisitions,
        int RecommendedRequisitions,
        int PendingFinalDecisionRequisitions,
        int NonRecommendedRequisitions,
        int AppItemCount,
        bool IsReady,
        string? Message,
        IReadOnlyList<ProcurementPlanRecommendationRequisitionResponse> Requisitions);
}

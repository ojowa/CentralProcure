using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class ProcurementPlansController
{
    [HttpPost("{planId:guid}/approval-decision")]
    public async Task<IActionResult> DecideAppApproval(Guid planId, [FromBody] ProcurementPlanApprovalDecisionRequest request, CancellationToken ct)
    {
        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        if (!string.Equals(roleKey, "comptroller_procurement", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(roleKey, "accounting_officer", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(roleKey, "admin", StringComparison.OrdinalIgnoreCase))
            return Forbid();

        var normalizedDecision = NormalizeApprovalDecision(request.Decision);
        if (normalizedDecision is null)
            return BadRequest("Decision must be one of: approve, return, reject.");

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            var plan = await GetPlanDetailAsync(conn, tx, planId, ct);
            if (plan is null)
                return NotFound();
            if (!string.Equals(plan.CurrentStageKey, "app_approval", StringComparison.OrdinalIgnoreCase))
                return BadRequest("Plan is not currently awaiting APP approval.");

            var actor = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name;
            var noteEntry = BuildApprovalDecisionNote(normalizedDecision, request.Note, actor);
            var target = ResolveApprovalDecisionTarget(normalizedDecision);
            await UpdatePlanForApprovalDecisionAsync(conn, tx, planId, target.PlanStatus, noteEntry, target.ApprovedAt, ct);
            if (string.Equals(normalizedDecision, "return", StringComparison.OrdinalIgnoreCase))
            {
                await ReopenPlanningCommitteeReviewsAsync(conn, tx, planId, ct);
            }
            await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest(
                "procurement_plan", planId, target.StageKey, target.WorkflowStatus, plan.PlanTitle, null, null,
                plan.TotalBudget, null, null, noteEntry, actor, "app_approval_decision"), ct);
            await tx.CommitAsync(ct);

            return Ok(new ProcurementPlanApprovalDecisionResponse(
                planId, normalizedDecision, target.Message, target.StageKey, target.StageTitle,
                target.WorkflowStatus, target.PlanStatus, target.ApprovedAt));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error applying APP approval decision for plan {PlanId}.", planId);
            return Problem("Internal server error applying APP approval decision.");
        }
    }

    [HttpPost("{planId:guid}/initiate-procurement")]
    public async Task<IActionResult> InitiateProcurement(Guid planId, CancellationToken ct)
    {
        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        if (!string.Equals(roleKey, "comptroller_procurement", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(roleKey, "requisitioning_officer", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(roleKey, "admin", StringComparison.OrdinalIgnoreCase))
            return Forbid();

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            var plan = await GetPlanDetailAsync(conn, tx, planId, ct);
            if (plan is null)
                return NotFound();
            if (!string.Equals(plan.CurrentStageKey, "procurement_initiation", StringComparison.OrdinalIgnoreCase))
                return BadRequest("Plan is not currently at procurement initiation.");

            var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(conn, tx, "procurement_plan", planId, "threshold_resolution", ct);
            if (!transition.IsAllowed)
                return BadRequest(transition.Message ?? "Threshold resolution is not allowed for this plan.");

            var routeDecision = await _workflowPolicyGuard.ResolveRouteDecisionAsync(conn, tx, "procurement_plan", planId, ct);
            var actor = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name;
            var routeSummary = routeDecision is null
                ? "Procurement initiated without an active threshold match."
                : $"Procurement initiated. Threshold route: {routeDecision.ApprovalAuthorityLabel ?? routeDecision.ApprovalRoute ?? "Unspecified"}.";

            await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest(
                "procurement_plan", planId, "threshold_resolution", "Under Review", plan.PlanTitle, null, null,
                plan.TotalBudget, routeDecision?.ProcurementType, routeDecision?.ThresholdId, routeSummary, actor, "procurement_initiation"), ct);

            await tx.CommitAsync(ct);
            return Ok(new ProcurementInitiationResponse(
                planId, routeSummary, "threshold_resolution", "Threshold Resolution", "Under Review",
                routeDecision?.ThresholdId, routeDecision?.ApprovalRoute, routeDecision?.ApprovalAuthorityCode,
                routeDecision?.ApprovalAuthorityLabel, routeDecision?.RequiresCgisApproval ?? false,
                routeDecision?.RequiresBoard ?? false, routeDecision?.RequiresBpp ?? false,
                routeDecision?.GovernanceBodyId, routeDecision?.GovernanceBodyName, routeDecision?.Amount,
                routeDecision?.ProcurementType, routeDecision?.Notes));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initiating procurement for plan {PlanId}.", planId);
            return Problem("Internal server error initiating procurement.");
        }
    }

    private static async Task ReopenPlanningCommitteeReviewsAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid planId,
        CancellationToken ct)
    {
        const string resetStatusesSql = """
WITH tracked_requisitions AS (
    SELECT requisition_id
    FROM procurement_workflow.planning_committee_plan_links
    WHERE plan_id = @p_plan_id
    UNION
    SELECT r.requisition_id
    FROM procurement_workflow.requisitions r
    JOIN procurement_workflow.procurement_plan_items i ON i.plan_item_id = r.app_item_id
    WHERE i.plan_id = @p_plan_id
)
DELETE FROM procurement_workflow.planning_committee_member_status s
USING tracked_requisitions tr
WHERE s.requisition_id = tr.requisition_id;
""";
        await using (var resetStatusesCmd = new NpgsqlCommand(resetStatusesSql, conn, tx))
        {
            resetStatusesCmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
            await resetStatusesCmd.ExecuteNonQueryAsync(ct);
        }

        const string resetRequisitionStatusSql = """
WITH tracked_requisitions AS (
    SELECT requisition_id
    FROM procurement_workflow.planning_committee_plan_links
    WHERE plan_id = @p_plan_id
    UNION
    SELECT r.requisition_id
    FROM procurement_workflow.requisitions r
    JOIN procurement_workflow.procurement_plan_items i ON i.plan_item_id = r.app_item_id
    WHERE i.plan_id = @p_plan_id
)
UPDATE procurement_workflow.requisitions r
SET status = 'Under Review',
    updated_at = NOW()
FROM tracked_requisitions tr
WHERE r.requisition_id = tr.requisition_id;
""";
        await using var resetRequisitionsCmd = new NpgsqlCommand(resetRequisitionStatusSql, conn, tx);
        resetRequisitionsCmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        await resetRequisitionsCmd.ExecuteNonQueryAsync(ct);

        const string bumpReviewRoundSql = """
UPDATE procurement_workflow.procurement_plans
SET review_round = COALESCE(review_round, 1) + 1,
    updated_at = NOW()
WHERE plan_id = @p_plan_id;
""";
        await using var bumpReviewRoundCmd = new NpgsqlCommand(bumpReviewRoundSql, conn, tx);
        bumpReviewRoundCmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        await bumpReviewRoundCmd.ExecuteNonQueryAsync(ct);
    }
}

using System.Security.Claims;
using eProcurement.Modules.Governance.DTOs;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Governance.Controllers;

public partial class BudgetLedgerController
{
    [Authorize]
    [HttpPost("confirmations/{planId:guid}/decision")]
    public async Task<IActionResult> DecideBudgetConfirmation(Guid planId, [FromBody] BudgetDecisionRequest request, CancellationToken ct)
    {
        if (!CanActAsBudgetOfficer())
        {
            return Forbid();
        }

        var normalizedDecision = NormalizeFilter(request.Decision)?.ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedDecision))
        {
            return BadRequest("Decision is required.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var plan = await GetPlanDecisionContextAsync(conn, tx, planId, ct);
            if (plan is null)
            {
                return NotFound();
            }

            var actor = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name;
            var noteEntry = BuildDecisionNote(normalizedDecision, request.Note, actor);
            var target = ResolveDecisionTarget(normalizedDecision, plan);

            await AppendDecisionNoteAsync(conn, tx, planId, noteEntry, target.PlanStatus, ct);
            await _workflowRuntimeTracker.SyncAsync(
                conn,
                tx,
                new WorkflowRuntimeSyncRequest(
                    "procurement_plan",
                    planId,
                    target.StageKey,
                    target.WorkflowStatus,
                    plan.PlanTitle,
                    null,
                    null,
                    plan.TotalBudget,
                    null,
                    null,
                    noteEntry,
                    actor,
                    "budget_officer_decision"),
                ct);

            await tx.CommitAsync(ct);

            return Ok(new BudgetDecisionResponse(
                planId,
                normalizedDecision,
                target.Message,
                target.StageKey,
                target.StageTitle,
                target.WorkflowStatus,
                target.PlanStatus));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error applying budget decision for plan {PlanId}.", planId);
            return Problem("Internal server error applying budget decision.");
        }
    }

    private static async Task<PlanDecisionContext?> GetPlanDecisionContextAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid planId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT
    p.plan_id,
    p.plan_title,
    p.status AS plan_status,
    p.total_budget,
    COALESCE(wi.current_stage_key, CASE WHEN p.status = 'Initial' THEN 'budget_code_allocation' ELSE 'department_need_capture' END) AS current_stage_key,
    COALESCE(sc.stage_title, CASE WHEN p.status = 'Initial' THEN 'Budget Code Allocation' ELSE 'Department Need Capture' END) AS current_stage_title
FROM procurement_workflow.procurement_plans p
LEFT JOIN procurement_workflow.workflow_instances wi
    ON wi.entity_type = 'procurement_plan'
   AND wi.entity_id = p.plan_id
LEFT JOIN procurement_workflow.workflow_stage_catalog sc
    ON sc.stage_key = wi.current_stage_key
WHERE p.plan_id = @p_plan_id
FOR UPDATE;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new PlanDecisionContext(
            reader.GetGuid(reader.GetOrdinal("plan_id")),
            reader.GetString(reader.GetOrdinal("plan_title")),
            reader.GetString(reader.GetOrdinal("plan_status")),
            reader.GetString(reader.GetOrdinal("current_stage_key")),
            reader.GetString(reader.GetOrdinal("current_stage_title")),
            reader.GetDecimal(reader.GetOrdinal("total_budget")));
    }

    private static string BuildDecisionNote(string decision, string? note, string? actor)
    {
        var decisionLabel = decision.Replace('_', ' ');
        var stamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss 'UTC'");
        var actorLabel = string.IsNullOrWhiteSpace(actor) ? "system" : actor.Trim();
        var message = string.IsNullOrWhiteSpace(note) ? "No note supplied." : note.Trim();
        return $"[{stamp}] Budget officer {decisionLabel}: {message} (actor: {actorLabel})";
    }

    private static DecisionTarget ResolveDecisionTarget(string decision, PlanDecisionContext plan)
    {
        var currentStageKey = plan.CurrentStageKey;
        var currentStageTitle = plan.CurrentStageTitle;
        var currentPlanStatus = plan.CurrentPlanStatus;

        return decision switch
        {
            "start_review" when string.Equals(currentStageKey, "planning_committee_review", StringComparison.OrdinalIgnoreCase)
                => new DecisionTarget("app_approval", "APP Approval", "Under Review", "Initial", "Review started and routed for APP approval."),
            "confirm" when string.Equals(currentStageKey, "planning_committee_review", StringComparison.OrdinalIgnoreCase)
                => new DecisionTarget("app_approval", "APP Approval", "Budget Confirmed", "Initial", "Funding confirmed and routed for APP approval."),
            "hold"
                => new DecisionTarget(currentStageKey, currentStageTitle, "On Hold", currentPlanStatus, "Plan placed on hold for budget clarification."),
            "return"
                => new DecisionTarget("comptroller_procurement_review", "Comptroller Procurement Review", "Returned", "Draft", "Plan returned for procurement correction."),
            "reject"
                => new DecisionTarget(currentStageKey, currentStageTitle, "Rejected", "Rejected", "Plan rejected at budget review."),
            _ => throw new InvalidOperationException("Decision must be one of: start_review, confirm, hold, return, reject.")
        };
    }

    private static async Task AppendDecisionNoteAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid planId,
        string noteEntry,
        string planStatus,
        CancellationToken ct)
    {
        const string sql = @"
UPDATE procurement_workflow.procurement_plans
SET
    status = @p_status,
    notes = CASE
        WHEN NULLIF(BTRIM(notes), '') IS NULL THEN @p_note
        ELSE notes || E'\n\n' || @p_note
    END,
    updated_at = NOW()
WHERE plan_id = @p_plan_id;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, planStatus);
        cmd.Parameters.AddWithValue("p_note", NpgsqlDbType.Text, noteEntry);

        var affected = await cmd.ExecuteNonQueryAsync(ct);
        if (affected == 0)
        {
            throw new InvalidOperationException("Procurement plan could not be updated.");
        }
    }

    private bool CanActAsBudgetOfficer()
    {
        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        return string.Equals(roleKey, "financial_unit_officer", StringComparison.OrdinalIgnoreCase)
            || string.Equals(roleKey, "accounting_officer", StringComparison.OrdinalIgnoreCase)
            || string.Equals(roleKey, "admin", StringComparison.OrdinalIgnoreCase);
    }

    private sealed record PlanDecisionContext(
        Guid PlanId,
        string PlanTitle,
        string CurrentPlanStatus,
        string CurrentStageKey,
        string CurrentStageTitle,
        decimal TotalBudget);

    private sealed record DecisionTarget(
        string StageKey,
        string StageTitle,
        string WorkflowStatus,
        string PlanStatus,
        string Message);
}

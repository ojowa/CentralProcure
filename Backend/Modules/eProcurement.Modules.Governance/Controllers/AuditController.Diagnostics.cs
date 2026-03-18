using eProcurement.Modules.Governance.DTOs;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace eProcurement.Modules.Governance.Controllers;

public partial class AuditController
{
    [HttpGet("diagnostics/{entityType}/{entityId:guid}")]
    public async Task<IActionResult> GetWorkflowDiagnostics(string entityType, Guid entityId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        var runtime = await _workflowRuntimeTracker.GetAsync(connectionString, entityType, entityId, ct);
        if (runtime is null)
        {
            return NotFound();
        }

        var history = await _workflowRuntimeTracker.GetHistoryAsync(connectionString, entityType, entityId, ct);
        var actionSnapshot = await _workflowActionGrantService.GetSnapshotAsync(connectionString, User, entityType, entityId, ct);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var routeDecision = await _workflowPolicyGuard.ResolveRouteDecisionAsync(conn, tx, entityType, entityId, ct);
            var checks = new List<AuditTransitionDiagnostic>();
            foreach (var transition in runtime.NextTransitions)
            {
                var result = await _workflowPolicyGuard.EvaluateTransitionAsync(conn, tx, entityType, entityId, transition.ToStageKey, ct);
                checks.Add(new AuditTransitionDiagnostic(
                    transition.ToStageKey,
                    transition.StageTitle,
                    transition.TransitionCondition,
                    result.IsAllowed,
                    result.Message));
            }

            await tx.CommitAsync(ct);

            return Ok(new AuditWorkflowDiagnosticsResponse(
                runtime,
                routeDecision,
                actionSnapshot?.RoleKey,
                actionSnapshot?.Actions ?? Array.Empty<WorkflowGrantedAction>(),
                history.Take(20).ToArray(),
                checks));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error retrieving workflow diagnostics for {EntityType} {EntityId}.", entityType, entityId);
            return Problem("Internal server error retrieving workflow diagnostics.");
        }
    }
}

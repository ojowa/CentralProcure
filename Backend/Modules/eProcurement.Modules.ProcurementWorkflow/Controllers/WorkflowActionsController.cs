using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Authorize]
[Route("api/workflow-actions")]
public class WorkflowActionsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly WorkflowActionGrantService _workflowActionGrantService;
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;

    public WorkflowActionsController(
        IConfiguration config,
        WorkflowActionGrantService workflowActionGrantService,
        WorkflowPolicyGuard workflowPolicyGuard)
    {
        _config = config;
        _workflowActionGrantService = workflowActionGrantService;
        _workflowPolicyGuard = workflowPolicyGuard;
    }

    [HttpGet("{entityType}/{entityId:guid}")]
    public async Task<IActionResult> GetWorkflowActions(string entityType, Guid entityId, CancellationToken ct)
    {
        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        var snapshot = await _workflowActionGrantService.GetSnapshotAsync(connectionString, User, entityType, entityId, ct);
        if (snapshot is null)
        {
            return NotFound();
        }

        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var routeDecision = await _workflowPolicyGuard.ResolveRouteDecisionAsync(conn, tx, entityType, entityId, ct);
        await tx.CommitAsync(ct);

        return Ok(new
        {
            snapshot.EntityType,
            snapshot.EntityId,
            snapshot.CurrentStageKey,
            snapshot.CurrentStageTitle,
            snapshot.RoleKey,
            Actions = snapshot.Actions,
            Authority = snapshot.Authority,
            RouteDecision = routeDecision
        });
    }
}

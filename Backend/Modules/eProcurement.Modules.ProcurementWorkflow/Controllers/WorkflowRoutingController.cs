using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/workflow-routing")]
public class WorkflowRoutingController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;

    public WorkflowRoutingController(IConfiguration config, WorkflowPolicyGuard workflowPolicyGuard)
    {
        _config = config;
        _workflowPolicyGuard = workflowPolicyGuard;
    }

    [HttpGet("{entityType}/{entityId:guid}")]
    public async Task<IActionResult> GetRouteDecision(string entityType, Guid entityId, CancellationToken ct)
    {
        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var decision = await _workflowPolicyGuard.ResolveRouteDecisionAsync(conn, tx, entityType, entityId, ct);
        await tx.CommitAsync(ct);

        return decision is null ? NotFound() : Ok(decision);
    }
}

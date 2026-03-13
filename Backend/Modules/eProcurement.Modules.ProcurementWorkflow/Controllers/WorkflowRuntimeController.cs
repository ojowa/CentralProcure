using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/workflow-runtime")]
public class WorkflowRuntimeController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

    public WorkflowRuntimeController(IConfiguration config, WorkflowRuntimeTracker workflowRuntimeTracker)
    {
        _config = config;
        _workflowRuntimeTracker = workflowRuntimeTracker;
    }

    [HttpGet("{entityType}/{entityId:guid}")]
    public async Task<IActionResult> GetWorkflowRuntime(string entityType, Guid entityId, CancellationToken ct)
    {
        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        var snapshot = await _workflowRuntimeTracker.GetAsync(connectionString, entityType, entityId, ct);
        return snapshot is null ? NotFound() : Ok(snapshot);
    }

    [HttpGet("{entityType}/{entityId:guid}/history")]
    public async Task<IActionResult> GetWorkflowRuntimeHistory(string entityType, Guid entityId, CancellationToken ct)
    {
        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        var history = await _workflowRuntimeTracker.GetHistoryAsync(connectionString, entityType, entityId, ct);
        return Ok(history);
    }
}

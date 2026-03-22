using eProcurement.Modules.VendorSourcing.DTOs;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;

namespace eProcurement.Modules.VendorSourcing.Controllers;

[ApiController]
[Route("api/tenders/{tenderId:guid}/workflow-display")]
public class TenderWorkflowController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<TenderWorkflowController> _logger;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

    public TenderWorkflowController(
        IConfiguration config,
        ILogger<TenderWorkflowController> logger,
        WorkflowRuntimeTracker workflowRuntimeTracker)
    {
        _config = config;
        _logger = logger;
        _workflowRuntimeTracker = workflowRuntimeTracker;
    }

    [HttpGet]
    public async Task<IActionResult> GetWorkflowDisplay(Guid tenderId, CancellationToken ct)
    {
        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            var snapshot = await _workflowRuntimeTracker.GetAsync(connectionString, "tender", tenderId, ct);
            if (snapshot is null)
            {
                return Ok(new TenderWorkflowDisplayResponse(tenderId, null, null, null));
            }

            return Ok(new TenderWorkflowDisplayResponse(
                tenderId,
                snapshot.CurrentStageKey,
                snapshot.CurrentStageTitle,
                WorkflowDisplayMapper.Build(snapshot)));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving workflow display for tender {TenderId}.", tenderId);
            return Problem("Internal server error retrieving tender workflow display.");
        }
    }
}

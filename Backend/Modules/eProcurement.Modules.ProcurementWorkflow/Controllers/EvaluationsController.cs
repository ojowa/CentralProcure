using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Modules.ProcurementWorkflow.Services;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/evaluations")]
public partial class EvaluationsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<EvaluationsController> _logger;
    private readonly IEvaluationService _evaluationService;

    public EvaluationsController(
        IConfiguration config,
        ILogger<EvaluationsController> logger,
        IEvaluationService evaluationService)
    {
        _config = config;
        _logger = logger;
        _evaluationService = evaluationService;
    }

    [HttpGet("assigned-tenders/{assignmentKey?}")]
    public async Task<IActionResult> GetAssignedTenders(string? assignmentKey, CancellationToken ct)
    {
        try
        {
            var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
            var internalUserId = ResolveInternalUserId();
            var results = await _evaluationService.GetAssignedTendersAsync(roleKey, internalUserId, ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting assigned tenders.");
            return Problem("Internal server error.");
        }
    }

    [HttpPost("actions")]
    public async Task<IActionResult> LogEvaluationAction([FromBody] EvaluationActionRequest request, CancellationToken ct)
    {
        try
        {
            var actionId = await _evaluationService.LogEvaluationActionAsync(request, User, ct);
            return Ok(new { actionId, status = "logged" });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error logging evaluation action.");
            return Problem("Internal server error.");
        }
    }

    private string? ResolveActor()
        => User.FindFirstValue(ClaimTypes.Email) ??
           User.FindFirstValue(ClaimTypes.Name) ??
           User.Identity?.Name;

    private Guid? ResolveInternalUserId()
    {
        var raw = User.FindFirstValue("internalUserId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var parsed) ? parsed : null;
    }
}

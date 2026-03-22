using System.Data;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/planning-committee/workspace")]
public partial class PlanningCommitteeWorkspaceController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<PlanningCommitteeWorkspaceController> _logger;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

    public PlanningCommitteeWorkspaceController(
        IConfiguration config,
        ILogger<PlanningCommitteeWorkspaceController> logger,
        WorkflowRuntimeTracker workflowRuntimeTracker)
    {
        _config = config;
        _logger = logger;
        _workflowRuntimeTracker = workflowRuntimeTracker;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    [HttpGet("queue")]
    public async Task<IActionResult> GetQueue(CancellationToken ct)
    {
        try
        {
            await using var conn = new NpgsqlConnection(GetConnectionString());
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var requisitions = await GetQueueRequisitionsAsync(conn, tx, ct);
            var plans = await GetAvailablePlansAsync(conn, tx, ct);
            var authority = BuildQueueAuthority(WorkflowActionGrantService.ResolveRoleKey(User));
            await tx.CommitAsync(ct);

            return Ok(new PlanningCommitteeWorkspaceQueueResponse(
                requisitions.Where(item => item.CommitteePlanId is null && item.AppItemId is null).ToList(),
                requisitions.Where(item => item.CommitteePlanId is not null || item.AppItemId is not null).ToList(),
                plans,
                authority));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving planning committee workspace queue.");
            return Problem("Internal server error retrieving planning committee queue.");
        }
    }

    [HttpGet("requisitions/{requisitionId:guid}")]
    public async Task<IActionResult> GetWorkspace(Guid requisitionId, CancellationToken ct)
    {
        try
        {
            await using var conn = new NpgsqlConnection(GetConnectionString());
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var workspace = await BuildWorkspaceAsync(conn, tx, requisitionId, WorkflowActionGrantService.ResolveRoleKey(User), ct);
            await tx.CommitAsync(ct);
            return workspace is null ? NotFound() : Ok(workspace);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving planning committee workspace for requisition {RequisitionId}.", requisitionId);
            return Problem("Internal server error retrieving committee workspace.");
        }
    }

    [HttpPost("requisitions/{requisitionId:guid}/link")]
    public async Task<IActionResult> Link(Guid requisitionId, [FromBody] PlanningCommitteeWorkspaceLinkRequest request, CancellationToken ct)
    {
        if (request is null)
        {
            return BadRequest("Request body is required.");
        }

        try
        {
            await using var conn = new NpgsqlConnection(GetConnectionString());
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var context = await GetLinkContextAsync(conn, tx, requisitionId, ct);
            if (context is null)
            {
                return NotFound();
            }

            var result = await LinkRequisitionAsync(conn, tx, context, request, User.Identity?.Name ?? string.Empty, ct);
            await tx.CommitAsync(ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error linking planning committee requisition {RequisitionId}.", requisitionId);
            return Problem("Internal server error linking requisition to committee plan.");
        }
    }

    [HttpPost("requisitions/{requisitionId:guid}/unlink")]
    public async Task<IActionResult> Unlink(Guid requisitionId, [FromBody] PlanningCommitteeWorkspaceUnlinkRequest? request, CancellationToken ct)
    {
        try
        {
            await using var conn = new NpgsqlConnection(GetConnectionString());
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            await UnlinkRequisitionAsync(conn, tx, requisitionId, WorkflowActionGrantService.ResolveRoleKey(User), User.Identity?.Name ?? string.Empty, request?.Reason, ct);
            await tx.CommitAsync(ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unlinking planning committee requisition {RequisitionId}.", requisitionId);
            return Problem("Internal server error unlinking planning committee requisition.");
        }
    }

    [HttpPost("requisitions/{requisitionId:guid}/member-review")]
    public async Task<IActionResult> SubmitMemberReview(Guid requisitionId, [FromBody] PlanningCommitteeMemberReviewActionRequest request, CancellationToken ct)
    {
        try
        {
            await using var conn = new NpgsqlConnection(GetConnectionString());
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
            var response = await SubmitMemberReviewAsync(conn, tx, requisitionId, roleKey, User.Identity?.Name ?? string.Empty, request, ct);
            await tx.CommitAsync(ct);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting planning committee member review for requisition {RequisitionId}.", requisitionId);
            return Problem("Internal server error submitting member review.");
        }
    }

    [HttpPost("requisitions/{requisitionId:guid}/finalize")]
    public async Task<IActionResult> Finalize(Guid requisitionId, [FromBody] PlanningCommitteeFinalizeReviewRequest request, CancellationToken ct)
    {
        try
        {
            await using var conn = new NpgsqlConnection(GetConnectionString());
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var response = await FinalizeReviewAsync(conn, tx, requisitionId, WorkflowActionGrantService.ResolveRoleKey(User), User.Identity?.Name ?? string.Empty, request, ct);
            await tx.CommitAsync(ct);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error finalizing planning committee review for requisition {RequisitionId}.", requisitionId);
            return Problem("Internal server error finalizing committee review.");
        }
    }
}

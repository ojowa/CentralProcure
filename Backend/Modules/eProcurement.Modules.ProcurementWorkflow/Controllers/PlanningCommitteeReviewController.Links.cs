using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Modules.ProcurementWorkflow.Services;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class PlanningCommitteeReviewController
{
    [HttpGet("plan-links")]
    public async Task<IActionResult> GetPlanLinks(CancellationToken ct)
    {
        try
        {
            var results = await _reviewService.GetPlanLinksAsync(ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving planning committee plan links.");
            return Problem("Internal server error retrieving planning committee plan links.");
        }
    }

    [HttpPost("requisitions/{requisitionId:guid}/link-plan")]
    public async Task<IActionResult> LinkRequisitionToPlan(
        Guid requisitionId,
        [FromBody] PlanningCommitteePlanLinkRequest request,
        CancellationToken ct)
    {
        if (request.PlanId == Guid.Empty)
        {
            return BadRequest("PlanId is required.");
        }

        try
        {
            var response = await _reviewService.LinkRequisitionToPlanAsync(
                requisitionId,
                request.PlanId,
                User.Identity?.Name,
                ct);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error linking requisition {RequisitionId} to planning committee plan.", requisitionId);
            return Problem("Internal server error linking requisition to plan.");
        }
    }

    [HttpPost("requisitions/{requisitionId:guid}/unlink-plan")]
    public async Task<IActionResult> UnlinkRequisitionFromPlan(Guid requisitionId, CancellationToken ct)
    {
        try
        {
            await _reviewService.UnlinkRequisitionFromPlanAsync(requisitionId, ct);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unlinking requisition {RequisitionId} from planning committee plan.", requisitionId);
            return Problem("Internal server error unlinking requisition from plan.");
        }
    }
}

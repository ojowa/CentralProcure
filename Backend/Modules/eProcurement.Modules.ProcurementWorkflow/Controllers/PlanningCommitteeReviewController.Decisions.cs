using Microsoft.AspNetCore.Mvc;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Modules.ProcurementWorkflow.Services;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class PlanningCommitteeReviewController
{
    [HttpPost("submit-committee-decision")]
    public async Task<IActionResult> SubmitCommitteeDecision([FromBody] CommitteeDecisionSubmitRequest request, CancellationToken ct)
    {
        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        if (!string.Equals(roleKey, "comptroller_procurement", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        if (request.RequisitionId == Guid.Empty)
        {
            return BadRequest("RequisitionId is required.");
        }

        try
        {
            var chairmanIdentity = ResolveCommitteeDecisionActor(User);
            var secretaryIdentity = ResolveCommitteeDecisionActor(User);

            var response = await _reviewService.SubmitCommitteeDecisionAsync(
                request,
                chairmanIdentity,
                secretaryIdentity,
                ct);

            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting committee decision for requisition {RequisitionId}", request.RequisitionId);
            return Problem("Internal server error submitting decision.");
        }
    }
}

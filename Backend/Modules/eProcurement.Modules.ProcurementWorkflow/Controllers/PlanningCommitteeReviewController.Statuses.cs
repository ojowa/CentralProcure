using Microsoft.AspNetCore.Mvc;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Modules.ProcurementWorkflow.Services;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class PlanningCommitteeReviewController
{
    [HttpGet("requisitions/{requisitionId:guid}/member-statuses")]
    public async Task<IActionResult> GetMemberStatuses(Guid requisitionId, CancellationToken ct)
    {
        try
        {
            var statuses = await _reviewService.GetMemberStatusesAsync(requisitionId, ct);
            return Ok(statuses);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving member statuses for requisition {RequisitionId}", requisitionId);
            return Problem("Internal server error retrieving member statuses.");
        }
    }

    [HttpGet("plans/{planId:guid}/member-statuses")]
    public async Task<IActionResult> GetPlanMemberStatuses(Guid planId, CancellationToken ct)
    {
        try
        {
            var statuses = await _reviewService.GetPlanMemberStatusesAsync(planId, ct);
            return Ok(statuses);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving member statuses for plan {PlanId}", planId);
            return Problem("Internal server error retrieving member statuses.");
        }
    }

    [HttpGet("committee-roles")]
    public async Task<IActionResult> GetCommitteeRoles(CancellationToken ct)
    {
        try
        {
            var roles = await _reviewService.GetCommitteeRolesAsync(ct);
            return Ok(roles);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving planning committee role definitions.");
            return Problem("Internal server error retrieving planning committee role definitions.");
        }
    }
}

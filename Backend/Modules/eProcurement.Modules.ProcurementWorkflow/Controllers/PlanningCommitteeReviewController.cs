using Microsoft.AspNetCore.Mvc;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Modules.ProcurementWorkflow.Services;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/planning-committee")]
public partial class PlanningCommitteeReviewController : ControllerBase
{
    private readonly ILogger<PlanningCommitteeReviewController> _logger;
    private readonly IPlanningCommitteeReviewService _reviewService;

    public PlanningCommitteeReviewController(
        ILogger<PlanningCommitteeReviewController> logger,
        IPlanningCommitteeReviewService reviewService)
    {
        _logger = logger;
        _reviewService = reviewService;
    }

    [HttpGet("requisitions/{requisitionId:guid}/reviews")]
    public async Task<IActionResult> GetReviews(Guid requisitionId, CancellationToken ct)
    {
        try
        {
            var reviews = await _reviewService.GetReviewsAsync(requisitionId, ct);
            return Ok(reviews);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving member reviews for requisition {RequisitionId}", requisitionId);
            return Problem("Internal server error retrieving reviews.");
        }
    }

    [HttpGet("plans/{planId:guid}/reviews")]
    public async Task<IActionResult> GetPlanReviews(Guid planId, CancellationToken ct)
    {
        try
        {
            var reviews = await _reviewService.GetPlanReviewsAsync(planId, ct);
            return Ok(reviews);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving member reviews for plan {PlanId}", planId);
            return Problem("Internal server error retrieving reviews.");
        }
    }

    [HttpPost("submit-member-review")]
    public async Task<IActionResult> SubmitMemberReview([FromBody] MemberReviewSubmitRequest request, CancellationToken ct)
    {
        try
        {
            var response = await _reviewService.SubmitMemberReviewAsync(request, ct);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting member review for plan {PlanId}", request.PlanId);
            return Problem("Internal server error submitting review.");
        }
    }
}

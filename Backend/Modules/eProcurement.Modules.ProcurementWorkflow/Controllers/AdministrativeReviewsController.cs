using eProcurement.Shared.Controllers;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/administrative-reviews")]
public partial class AdministrativeReviewsController : BaseModuleController
{
    private static readonly string[] AllowedStatuses = { "Filed", "In Review", "Escalated", "Resolved", "Rejected", "Closed" };
    private static readonly string[] AllowedResolutionOutcomes =
    {
        "Resume Procurement",
        "Modify Decision",
        "Escalate To BPP",
        "Terminate Procurement",
        "Dismiss Complaint"
    };

    private static readonly HashSet<string> FilingStageKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "solicitation",
        "evaluation",
        "award_and_publication"
    };

    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private readonly WorkflowActionGrantService _workflowActionGrantService;

    public AdministrativeReviewsController(
        IConfiguration config,
        ILogger<AdministrativeReviewsController> logger,
        WorkflowPolicyGuard workflowPolicyGuard,
        WorkflowRuntimeTracker workflowRuntimeTracker,
        WorkflowActionGrantService workflowActionGrantService)
        : base(config, logger)
    {
        _workflowPolicyGuard = workflowPolicyGuard;
        _workflowRuntimeTracker = workflowRuntimeTracker;
        _workflowActionGrantService = workflowActionGrantService;
    }
}

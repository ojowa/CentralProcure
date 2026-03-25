using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/procurement-plans")]
public partial class ProcurementPlansController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<ProcurementPlansController> _logger;
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

    private static readonly string[] AllowedStatuses = { "Draft", "Submitted", "Under Review", "Approved", "Returned", "Rejected", "Cancelled" };
    private const int MinTitleLength = 5;
    private const int MaxTitleLength = 255;
    private const int MinDepartmentLength = 3;
    private const int MaxDepartmentLength = 150;
    private const int MinFiscalYear = 2000;
    private const int MaxFiscalYear = 2100;
    private const decimal MaxTotalBudget = 10000000000m;
    private const int DefaultPageSize = 10;
    private const int MaxPageSize = 100;
    private static readonly HashSet<string> AllowedSortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "plan_title",
        "department",
        "fiscal_year",
        "status",
        "total_budget",
        "created_at"
    };

    private static readonly HashSet<string> AllowedSortDirections = new(StringComparer.OrdinalIgnoreCase)
    {
        "asc",
        "desc"
    };

    public ProcurementPlansController(
        IConfiguration config,
        ILogger<ProcurementPlansController> logger,
        WorkflowPolicyGuard workflowPolicyGuard,
        WorkflowRuntimeTracker workflowRuntimeTracker)
    {
        _config = config;
        _logger = logger;
        _workflowPolicyGuard = workflowPolicyGuard;
        _workflowRuntimeTracker = workflowRuntimeTracker;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;
}

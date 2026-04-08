using eProcurement.Modules.Governance.Services;
using eProcurement.Shared.Controllers;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;

namespace eProcurement.Modules.Governance.Controllers;

[ApiController]
[Route("api/budget")]
public partial class BudgetLedgerController : BaseModuleController
{
    private const int MaxDepartmentLength = 150;
    private const int MaxBudgetCodeLength = 60;
    private const int DefaultPageSize = 12;
    private const int MaxPageSize = 100;

    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private readonly IBudgetLedgerService _budgetService;

    public BudgetLedgerController(
        IConfiguration config,
        ILogger<BudgetLedgerController> logger,
        WorkflowRuntimeTracker workflowRuntimeTracker,
        IBudgetLedgerService budgetService)
        : base(config, logger)
    {
        _workflowRuntimeTracker = workflowRuntimeTracker;
        _budgetService = budgetService;
    }
}

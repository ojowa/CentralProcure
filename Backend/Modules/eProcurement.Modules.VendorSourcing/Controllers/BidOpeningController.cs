using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.VendorSourcing.Controllers;

[ApiController]
[Authorize]
[Route("api/bid-opening")]
public partial class BidOpeningController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<BidOpeningController> _logger;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private readonly WorkflowActionGrantService _workflowActionGrantService;

    private static readonly string[] AllowedStatuses = { "Scheduled", "Open", "Closed", "Cancelled" };
    private static readonly HashSet<string> AllowedSortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "scheduled_at",
        "session_title",
        "status",
        "created_at",
        "location"
    };
    private static readonly HashSet<string> AllowedSortDirections = new(StringComparer.OrdinalIgnoreCase) { "asc", "desc" };
    private static readonly HashSet<string> ReadRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "comptroller_procurement",
        "technical_evaluator",
        "financial_evaluator",
        "evaluation_committee",
        "tenders_board",
        "accounting_officer",
        "bpp_reviewer",
        "audit_oversight",
        "ict_admin"
    };
    private static readonly HashSet<string> ManageRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "comptroller_procurement",
        "ict_admin"
    };
    private static readonly Dictionary<string, string> RoleAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["admin"] = "ict_admin",
        ["system_administrator"] = "ict_admin",
        ["tenders_board_member"] = "tenders_board",
        ["tenders_board_secretary"] = "tenders_board",
        ["audit_officer"] = "audit_oversight",
        ["bpp_liaison"] = "bpp_reviewer"
    };
    private const int DefaultPageSize = 10;
    private const int MaxPageSize = 100;

    public BidOpeningController(
        IConfiguration config,
        ILogger<BidOpeningController> logger,
        WorkflowRuntimeTracker workflowRuntimeTracker,
        WorkflowActionGrantService workflowActionGrantService)
    {
        _config = config;
        _logger = logger;
        _workflowRuntimeTracker = workflowRuntimeTracker;
        _workflowActionGrantService = workflowActionGrantService;
    }

    private sealed record TenderScheduleContext(Guid TenderId, string Status, DateTime? OpeningDate, DateTime? ClosingDate);
    private sealed record BidOpeningValidationState(
        Guid TenderId,
        DateTime ScheduledAt,
        string Status,
        string? Location,
        DateTime? OpenedAt,
        DateTime? ClosedAt,
        string? Notes);

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;
}


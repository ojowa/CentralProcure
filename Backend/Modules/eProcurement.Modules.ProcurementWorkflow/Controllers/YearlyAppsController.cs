using System.Security.Claims;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/yearly-apps")]
public partial class YearlyAppsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<YearlyAppsController> _logger;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

    public YearlyAppsController(
        IConfiguration config,
        ILogger<YearlyAppsController> logger,
        WorkflowRuntimeTracker workflowRuntimeTracker)
    {
        _config = config;
        _logger = logger;
        _workflowRuntimeTracker = workflowRuntimeTracker;
    }

    [HttpGet]
    public async Task<IActionResult> GetYearlyApps(CancellationToken ct)
    {
        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            var results = await GetYearlyAppSummariesAsync(conn, tx, ct);
            await tx.CommitAsync(ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving yearly APPs.");
            return Problem("Internal server error retrieving yearly APPs.");
        }
    }

    [HttpGet("{yearlyAppId:guid}")]
    public async Task<IActionResult> GetYearlyApp(Guid yearlyAppId, CancellationToken ct)
    {
        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            var app = await GetYearlyAppDetailAsync(conn, tx, yearlyAppId, ct);
            if (app is null)
                return NotFound();

            var groupedPlans = await GetYearlyAppPlanGroupsAsync(conn, tx, yearlyAppId, ct);
            await tx.CommitAsync(ct);
            return Ok(new YearlyAppDetailsResponse(app, groupedPlans.IncludedPlans, groupedPlans.PendingPlans));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving yearly APP {YearlyAppId}.", yearlyAppId);
            return Problem("Internal server error retrieving yearly APP.");
        }
    }

    [HttpGet("{yearlyAppId:guid}/recommendation-readiness")]
    public async Task<IActionResult> GetRecommendationReadiness(Guid yearlyAppId, CancellationToken ct)
    {
        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            var app = await GetYearlyAppDetailAsync(conn, tx, yearlyAppId, ct);
            if (app is null)
                return NotFound();

            var readiness = await ValidateRecommendationReadinessAsync(conn, tx, yearlyAppId, ct);
            await tx.CommitAsync(ct);
            return Ok(new YearlyAppRecommendationReadinessResponse(
                yearlyAppId,
                app.PlansCount,
                readiness.TotalTrackedRequisitions,
                readiness.RecommendedRequisitions,
                readiness.PendingFinalDecisionRequisitions,
                readiness.NonRecommendedRequisitions,
                readiness.AppItemCount,
                readiness.IsReady,
                readiness.Message ?? "Yearly APP is ready to be recommended for approval.",
                readiness.Requisitions));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving yearly APP readiness for {YearlyAppId}.", yearlyAppId);
            return Problem("Internal server error retrieving yearly APP readiness.");
        }
    }

    [HttpPost("{yearlyAppId:guid}/recommend-for-approval")]
    public async Task<IActionResult> RecommendForApproval(Guid yearlyAppId, CancellationToken ct)
    {
        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        if (!string.Equals(roleKey, "procurement_secretary", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(roleKey, "admin", StringComparison.OrdinalIgnoreCase))
            return Forbid();

        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            var app = await GetYearlyAppDetailAsync(conn, tx, yearlyAppId, ct);
            if (app is null)
                return NotFound();

            var effectiveStage = ResolveEffectiveStageKey(app.Status, app.CurrentStageKey);
            if (!string.Equals(effectiveStage, "planning_committee_review", StringComparison.OrdinalIgnoreCase))
                return BadRequest("Yearly APP is not currently at planning committee review.");

            var ready = await ValidateRecommendationReadinessAsync(conn, tx, yearlyAppId, ct);
            if (!ready.IsReady)
                return BadRequest(ready.Message);

            var actor = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name ?? "system";
            var submittedAt = DateTime.UtcNow;
            var note = $"[{submittedAt:yyyy-MM-dd HH:mm:ss 'UTC'}] Yearly APP recommended by Procurement Secretary for Comptroller Procurement approval. (actor: {actor})";
            await UpdateYearlyAppAsync(conn, tx, yearlyAppId, "Submitted", note, submittedAt, ct);
            await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest(
                "yearly_app", yearlyAppId, "app_approval", "Submitted", app.Title,
                null, null, app.TotalBudget, null, null, note, actor, "app_recommended_for_approval"), ct);
            await tx.CommitAsync(ct);

            return Ok(new YearlyAppRecommendationResponse(
                yearlyAppId,
                "Yearly APP recommended to Comptroller Procurement for approval.",
                "app_approval",
                "APP Approval",
                "Submitted",
                "Submitted",
                submittedAt));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recommending yearly APP {YearlyAppId}.", yearlyAppId);
            return Problem("Internal server error recommending yearly APP.");
        }
    }

    private static string ResolveEffectiveStageKey(string status, string? currentStageKey) =>
        !string.IsNullOrWhiteSpace(currentStageKey)
            ? currentStageKey
            : string.Equals(status, "Approved", StringComparison.OrdinalIgnoreCase)
                ? "procurement_initiation"
                : "planning_committee_review";
}

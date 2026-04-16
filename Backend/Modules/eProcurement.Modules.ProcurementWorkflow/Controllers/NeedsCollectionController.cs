using System.Security.Claims;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/needs-collection")]
public partial class NeedsCollectionController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<NeedsCollectionController> _logger;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

    public NeedsCollectionController(
        IConfiguration config,
        ILogger<NeedsCollectionController> logger,
        WorkflowRuntimeTracker workflowRuntimeTracker)
    {
        _config = config;
        _logger = logger;
        _workflowRuntimeTracker = workflowRuntimeTracker;
    }

    private string? GetActor() => User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name;

    [HttpGet]
    public async Task<IActionResult> GetNeeds(CancellationToken ct)
    {
        var connectionString = _config.GetConnectionString("Primary");
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            
            // Get user's unit to filter if not admin/comptroller
            var unitIdClaim = User.FindFirstValue("UnitId");
            Guid? unitId = string.IsNullOrEmpty(unitIdClaim) ? null : Guid.Parse(unitIdClaim);
            var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
            
            // Restricted roles only see their unit's needs
            bool restrictToUnit = roleKey is "formation_officer" or "formation_head" or "requisitioning_officer" or "department_head";
            if (roleKey == "admin" || roleKey == "comptroller_procurement") restrictToUnit = false;

            var results = await GetNeedAssessmentSummariesAsync(conn, restrictToUnit ? unitId : null, ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving need assessments.");
            return Problem("Internal server error retrieving need assessments.");
        }
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetNeedDetail(Guid id, CancellationToken ct)
    {
        var connectionString = _config.GetConnectionString("Primary");
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            var result = await GetNeedAssessmentDetailAsync(conn, id, ct);
            if (result == null) return NotFound();
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving need assessment detail {Id}.", id);
            return Problem("Internal server error retrieving need assessment.");
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateNeed(NeedAssessmentCreateRequest request, CancellationToken ct)
    {
        var actor = GetActor() ?? "system";
        var unitIdClaim = User.FindFirstValue("UnitId");
        if (string.IsNullOrEmpty(unitIdClaim)) return BadRequest("User must be assigned to an organizational unit.");
        var unitId = Guid.Parse(unitIdClaim);

        var connectionString = _config.GetConnectionString("Primary");
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var id = await UpsertNeedAssessmentAsync(conn, tx, null, unitId, request.Title, request.FiscalYear, "Draft", request.Remarks, actor, ct);
            
            foreach (var item in request.Items)
            {
                await CreateNeedAssessmentItemAsync(conn, tx, id, item, ct);
            }

            await tx.CommitAsync(ct);
            return Ok(new { NeedAssessmentId = id, Message = "Need assessment created successfully." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating need assessment.");
            return Problem("Internal server error creating need assessment.");
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateNeed(Guid id, NeedAssessmentUpdateRequest request, CancellationToken ct)
    {
        var actor = GetActor() ?? "system";
        var connectionString = _config.GetConnectionString("Primary");
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var existing = await GetNeedAssessmentDetailAsync(conn, id, ct);
            if (existing == null) return NotFound();
            if (existing.Status != "Draft" && existing.Status != "Returned") 
                return BadRequest("Only draft or returned assessments can be updated.");

            await UpsertNeedAssessmentAsync(conn, tx, id, existing.UnitId, request.Title ?? existing.Title, request.FiscalYear ?? existing.FiscalYear, request.Status ?? existing.Status, request.Remarks ?? existing.Remarks, actor, ct);

            if (request.Items != null)
            {
                await DeleteNeedAssessmentItemsAsync(conn, tx, id, ct);
                foreach (var item in request.Items)
                {
                    await CreateNeedAssessmentItemAsync(conn, tx, id, item, ct);
                }
            }

            await tx.CommitAsync(ct);
            return Ok(new { Message = "Need assessment updated successfully." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating need assessment {Id}.", id);
            return Problem("Internal server error updating need assessment.");
        }
    }

    [HttpPost("{id:guid}/decision")]
    public async Task<IActionResult> SubmitDecision(Guid id, NeedAssessmentDecisionRequest request, CancellationToken ct)
    {
        var actor = GetActor() ?? "system";
        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        var connectionString = _config.GetConnectionString("Primary");
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var existing = await GetNeedAssessmentDetailAsync(conn, id, ct);
            if (existing == null) return NotFound();

            string nextStatus = existing.Status;
            if (request.Decision == "Submit") 
            {
                if (existing.Status != "Draft" && existing.Status != "Returned") return BadRequest("Invalid status for submission.");
                nextStatus = "Submitted";
            }
            else if (request.Decision == "Endorse")
            {
                if (roleKey != "formation_head" && roleKey != "department_head" && roleKey != "admin") return Forbid();
                if (existing.Status != "Submitted") return BadRequest("Assessment must be submitted before endorsement.");
                nextStatus = "Endorsed";
            }
            else if (request.Decision == "Return")
            {
                nextStatus = "Returned";
            }
            else if (request.Decision == "Reject")
            {
                nextStatus = "Rejected";
            }

            await UpdateNeedAssessmentStatusAsync(conn, tx, id, nextStatus, request.Remarks, actor, ct);
            
            await tx.CommitAsync(ct);
            return Ok(new { Status = nextStatus, Message = $"Need assessment {request.Decision}ed successfully." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing decision for need assessment {Id}.", id);
            return Problem("Internal server error processing decision.");
        }
    }
}

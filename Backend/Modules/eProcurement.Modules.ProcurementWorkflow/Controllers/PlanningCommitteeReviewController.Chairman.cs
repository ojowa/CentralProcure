using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Modules.ProcurementWorkflow.Services;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class PlanningCommitteeReviewController
{
    [Authorize]
    [HttpGet("chairman")]
    public async Task<IActionResult> GetChairmanAssignment(CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var assignment = await PlanningCommitteeChairmanRegistry.GetAssignmentAsync(conn, tx, ct);
            await tx.CommitAsync(ct);
            return Ok(assignment);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving planning committee chairman assignment.");
            return Problem("Internal server error retrieving planning committee chairman.");
        }
    }

    [Authorize]
    [HttpPut("chairman")]
    public async Task<IActionResult> UpsertChairmanAssignment([FromBody] PlanningCommitteeChairmanAssignmentRequest request, CancellationToken ct)
    {
        if (!IsPlanningCommitteeAdmin())
        {
            return Forbid();
        }

        var connectionString = GetConnectionString();
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var assignment = await PlanningCommitteeChairmanRegistry.UpsertAssignmentAsync(
                conn,
                tx,
                request.InternalUserId,
                ResolveChairmanAssignmentActor(User),
                ResolveAuthenticatedInternalUserId(User),
                ct);

            await tx.CommitAsync(ct);
            return Ok(assignment);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating planning committee chairman assignment.");
            return Problem("Internal server error updating planning committee chairman.");
        }
    }

    private static Guid? ResolveAuthenticatedInternalUserId(ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue("internalUserId") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var parsed) ? parsed : null;
    }

    private static string ResolveChairmanAssignmentActor(ClaimsPrincipal user)
        => user.FindFirstValue(ClaimTypes.Email)
            ?? user.FindFirstValue(ClaimTypes.Name)
            ?? user.Identity?.Name
            ?? string.Empty;

    private bool IsPlanningCommitteeAdmin()
    {
        var resolvedRole = WorkflowActionGrantService.ResolveRoleKey(User);
        if (string.Equals(resolvedRole, "admin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(resolvedRole, "ict_admin", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var rawRole = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
        return string.Equals(rawRole, "SystemAdministrator", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(rawRole, "system_administrator", StringComparison.OrdinalIgnoreCase);
    }
}

using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Modules.ProcurementWorkflow.Services;
using eProcurement.Shared.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Authorize]
[Route("api/config/workflows")]
public partial class WorkflowConfigurationsController : BaseModuleController
{
    private static readonly string[] AllowedThresholdStatuses = { "Active", "Inactive" };

    public WorkflowConfigurationsController(IConfiguration config, ILogger<WorkflowConfigurationsController> logger)
        : base(config, logger)
    {
    }

    [HttpGet]
    public async Task<IActionResult> GetConfiguration(CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Ok(BuildFallbackConfiguration());
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            var stages = await GetStagesAsync(conn, ct);
            var transitions = await GetTransitionsAsync(conn, ct);
            var roleTasks = await GetRoleTasksAsync(conn, ct);
            var thresholds = await GetThresholdsAsync(conn, ct);
            var roles = await GetRolesAsync(conn, ct);
            var governanceBodies = await GetGovernanceBodiesAsync(conn, ct);

            return Ok(new WorkflowConfigurationResult(
                "Workflow Configuration Console",
                "Configure threshold routing, workflow stages, transitions, and role responsibilities from one admin workspace.",
                stages.Count > 0 ? stages : BuildFallbackConfiguration().Stages,
                transitions.Count > 0 ? transitions : BuildFallbackConfiguration().Transitions,
                roleTasks.Count > 0 ? roleTasks : BuildFallbackConfiguration().RoleTasks,
                thresholds,
                roles,
                governanceBodies));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error retrieving workflow configuration.");
            return Problem("Internal server error retrieving workflow configuration.");
        }
    }
}

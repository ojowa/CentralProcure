using System.Security.Claims;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Modules.ProcurementWorkflow.Services;
using eProcurement.Shared.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/workflow-blueprint")]
public class WorkflowBlueprintController : BaseModuleController
{
    public WorkflowBlueprintController(IConfiguration config, ILogger<WorkflowBlueprintController> logger)
        : base(config, logger)
    {
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetBlueprint(CancellationToken ct)
    {
        var currentRole = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
        var (thresholds, thresholdSource) = await LoadThresholdsAsync(ct);

        return Ok(WorkflowBlueprintCatalog.Build(currentRole, thresholds, thresholdSource));
    }

    private async Task<(IReadOnlyList<WorkflowThresholdBandResult> Thresholds, string Source)> LoadThresholdsAsync(CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return (WorkflowBlueprintCatalog.GetFallbackThresholds(), "catalog-fallback");
        }

        const string sql = @"
SELECT
    COALESCE(procurement_type, 'Goods/Works/Services') AS procurement_type,
    min_amount,
    max_amount,
    approval_route,
    approval_authority_code,
    approval_authority_label,
    requires_cgis_approval,
    requires_board,
    requires_bpp,
    governance_body_id,
    body.body_name AS governance_body_name,
    COALESCE(notes, '') AS notes
FROM procurement_workflow.approval_thresholds
LEFT JOIN procurement_workflow.governance_bodies body
    ON body.body_id = procurement_workflow.approval_thresholds.governance_body_id
WHERE status = 'Active'
ORDER BY procurement_type NULLS FIRST, min_amount ASC;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            await using var reader = await cmd.ExecuteReaderAsync(ct);

            var results = new List<WorkflowThresholdBandResult>();
            while (await reader.ReadAsync(ct))
            {
                results.Add(new WorkflowThresholdBandResult(
                    reader.GetString(reader.GetOrdinal("procurement_type")),
                    reader.GetDecimal(reader.GetOrdinal("min_amount")),
                    reader.IsDBNull(reader.GetOrdinal("max_amount")) ? null : reader.GetDecimal(reader.GetOrdinal("max_amount")),
                    reader.GetString(reader.GetOrdinal("approval_route")),
                    reader.GetString(reader.GetOrdinal("approval_authority_code")),
                    reader.GetString(reader.GetOrdinal("approval_authority_label")),
                    reader.GetBoolean(reader.GetOrdinal("requires_cgis_approval")),
                    reader.GetBoolean(reader.GetOrdinal("requires_board")),
                    reader.GetBoolean(reader.GetOrdinal("requires_bpp")),
                    reader.IsDBNull(reader.GetOrdinal("governance_body_id")) ? null : reader.GetGuid(reader.GetOrdinal("governance_body_id")),
                    reader.IsDBNull(reader.GetOrdinal("governance_body_name")) ? null : reader.GetString(reader.GetOrdinal("governance_body_name")),
                    reader.GetString(reader.GetOrdinal("notes"))));
            }

            return results.Count > 0
                ? (results, "database")
                : (WorkflowBlueprintCatalog.GetFallbackThresholds(), "catalog-fallback");
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "Unable to load live approval thresholds for workflow blueprint. Falling back to catalog defaults.");
            return (WorkflowBlueprintCatalog.GetFallbackThresholds(), "catalog-fallback");
        }
    }
}

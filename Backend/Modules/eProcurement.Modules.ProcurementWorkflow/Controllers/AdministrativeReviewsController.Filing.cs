using eProcurement.Modules.ProcurementWorkflow.DTOs;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class AdministrativeReviewsController
{
    [HttpGet("filing-context")]
    public async Task<IActionResult> GetFilingContext([FromQuery] string? entityType, [FromQuery] Guid? entityId, CancellationToken ct)
    {
        var normalizedEntityType = NormalizeNullable(entityType)?.ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedEntityType) || !entityId.HasValue || entityId.Value == Guid.Empty)
        {
            return BadRequest("EntityType and EntityId are required.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var parent = await GetWorkflowInstanceAsync(conn, tx, normalizedEntityType, entityId.Value, ct);
            if (parent is null)
            {
                return NotFound("The referenced workflow record was not found.");
            }

            var currentStageTitle = await GetStageTitleAsync(conn, tx, parent.CurrentStageKey, ct);
            var hasAction = await _workflowActionGrantService.HasRequiredActionAsync(
                conn,
                tx,
                User,
                normalizedEntityType,
                entityId.Value,
                "administrative_review.create",
                ct);

            string? reason = null;
            var canFile = hasAction;
            if (!hasAction)
            {
                reason = "You do not have complaint filing permission for this record at its current workflow stage.";
            }
            else if (!FilingStageKeys.Contains(parent.CurrentStageKey))
            {
                canFile = false;
                reason = "Complaints may only be filed from solicitation, evaluation, or award stages.";
            }
            else
            {
                var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(
                    conn,
                    tx,
                    normalizedEntityType,
                    entityId.Value,
                    "administrative_review",
                    ct);
                if (!transition.IsAllowed)
                {
                    canFile = false;
                    reason = transition.Message;
                }
            }

            await tx.CommitAsync(ct);
            return Ok(new AdministrativeReviewFilingContextResponse(
                normalizedEntityType,
                entityId.Value,
                parent.RecordTitle,
                parent.CurrentStageKey,
                currentStageTitle,
                canFile,
                reason,
                "If filed, this record will be routed into Administrative Review under Section 54 of PPA 2007."));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error retrieving administrative review filing context for {EntityType}:{EntityId}.", normalizedEntityType, entityId);
            return Problem("Internal server error retrieving complaint filing context.");
        }
    }

    private static async Task<string?> GetStageTitleAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string stageKey, CancellationToken ct)
    {
        const string sql = """
SELECT stage_title
FROM procurement_workflow.workflow_stage_catalog
WHERE stage_key = @p_stage_key;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_stage_key", NpgsqlDbType.Varchar, stageKey);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result as string;
    }
}

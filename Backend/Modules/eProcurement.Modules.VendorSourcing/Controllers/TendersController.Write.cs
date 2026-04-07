using System.Data;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.VendorSourcing.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.VendorSourcing.Controllers;

public partial class TendersController
{
    [HttpPost]
    public async Task<IActionResult> CreateTender([FromBody] TenderCreateRequest request, CancellationToken ct)
    {
        var validationError = ValidateCreateRequest(request, out var normalizedStatus);
        if (validationError is not null)
        {
            return BadRequest(validationError);
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

            var resolved = await ResolveCreateRequestAsync(conn, tx, request, normalizedStatus, ct);
            if (resolved.ErrorMessage is not null)
            {
                if (resolved.IsNotFound)
                {
                    return NotFound(resolved.ErrorMessage);
                }

                if (resolved.IsConflict)
                {
                    return Conflict(resolved.ErrorMessage);
                }

                return BadRequest(resolved.ErrorMessage);
            }

            if (!string.Equals(resolved.Status, "Draft", StringComparison.OrdinalIgnoreCase))
            {
                var threshold = await _workflowPolicyGuard.ResolveThresholdAsync(conn, tx, resolved.Category, resolved.Budget, ct);
                if (threshold?.RequiresCgisApproval == true)
                {
                    return BadRequest("Low-value tenders must be created in Draft so Comptroller Procurement can record the procurement method before solicitation.");
                }
            }

            await using var cmd = new NpgsqlCommand("vendor_sourcing.create_tender_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_title", NpgsqlDbType.Varchar, resolved.Title!);
            cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, (object?)resolved.RequisitionId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_description", NpgsqlDbType.Text, resolved.Description!);
            cmd.Parameters.AddWithValue("p_category", NpgsqlDbType.Varchar, resolved.Category!);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)resolved.Status ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_budget", NpgsqlDbType.Numeric, (object?)resolved.Budget ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)resolved.Department ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, (object?)resolved.BudgetCode ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)resolved.FiscalYear ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_specifications", NpgsqlDbType.Text, (object?)request.Specifications ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_eligibility_criteria", NpgsqlDbType.Text, (object?)request.EligibilityCriteria ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_evaluation_criteria", NpgsqlDbType.Text, (object?)request.EvaluationCriteria ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_publish_date", NpgsqlDbType.Timestamp, (object?)request.PublishDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_opening_date", NpgsqlDbType.Timestamp, (object?)request.OpeningDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_closing_date", NpgsqlDbType.Timestamp, (object?)request.ClosingDate ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapTenderDetail, ct);
            var result = results.FirstOrDefault();
            if (result is null)
            {
                return Problem("Tender creation failed.");
            }

            await SyncWorkflowRuntimeAsync(conn, tx, result, "Tender created.", ct);
            await tx.CommitAsync(ct);
            return Created($"/api/tenders/{result.TenderId}", result);
        }
        catch (PostgresException ex) when (ex.SqlState == "P0001")
        {
            _logger.LogWarning(ex, "Budget validation failed while creating tender.");
            return Conflict(ex.MessageText);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            _logger.LogWarning(ex, "Duplicate requisition-linked tender attempt for requisition {RequisitionId}.", request.RequisitionId);
            return Conflict("A tender already exists for the selected requisition.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating tender.");
            return Problem("Internal server error creating tender.");
        }
    }

    [HttpPut("{tenderId:guid}")]
    public async Task<IActionResult> UpdateTender(Guid tenderId, [FromBody] TenderUpdateRequest request, CancellationToken ct)
    {
        var validationError = ValidateUpdateRequest(request, out var normalizedStatus);
        if (validationError is not null)
        {
            return BadRequest(validationError);
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

            var hasAction = await _workflowActionGrantService.HasRequiredActionAsync(conn, tx, User, "tender", tenderId, "tender.manage", ct);
            if (!hasAction)
            {
                return Forbid();
            }

            if (!string.IsNullOrWhiteSpace(normalizedStatus))
            {
                var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(
                    conn,
                    tx,
                    "tender",
                    tenderId,
                    ResolveWorkflowStage(normalizedStatus),
                    ct);
                if (!transition.IsAllowed)
                {
                    return BadRequest(transition.Message);
                }
            }

            await using var cmd = new NpgsqlCommand("vendor_sourcing.update_tender_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);
            cmd.Parameters.AddWithValue("p_title", NpgsqlDbType.Varchar, (object?)request.Title ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_description", NpgsqlDbType.Text, (object?)request.Description ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_category", NpgsqlDbType.Varchar, (object?)request.Category ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_budget", NpgsqlDbType.Numeric, (object?)request.Budget ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)request.Department ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, (object?)request.BudgetCode ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)request.FiscalYear ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_specifications", NpgsqlDbType.Text, (object?)request.Specifications ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_eligibility_criteria", NpgsqlDbType.Text, (object?)request.EligibilityCriteria ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_evaluation_criteria", NpgsqlDbType.Text, (object?)request.EvaluationCriteria ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_publish_date", NpgsqlDbType.Timestamp, (object?)request.PublishDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_opening_date", NpgsqlDbType.Timestamp, (object?)request.OpeningDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_closing_date", NpgsqlDbType.Timestamp, (object?)request.ClosingDate ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapTenderDetail, ct);
            var result = results.FirstOrDefault();
            if (result is null)
            {
                return NotFound();
            }

            await SyncWorkflowRuntimeAsync(conn, tx, result, "Tender updated.", ct);
            await tx.CommitAsync(ct);
            return Ok(result);
        }
        catch (PostgresException ex) when (ex.SqlState == "P0001")
        {
            _logger.LogWarning(ex, "Budget validation failed while updating tender {TenderId}.", tenderId);
            return Conflict(ex.MessageText);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating tender {TenderId}.", tenderId);
            return Problem("Internal server error updating tender.");
        }
    }

    [HttpPost("{tenderId:guid}/publish")]
    public async Task<IActionResult> PublishTender(Guid tenderId, [FromBody] TenderPublishRequest request, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        if (request.OpeningDate.HasValue && request.ClosingDate.HasValue && request.ClosingDate < request.OpeningDate)
        {
            return BadRequest("ClosingDate cannot be earlier than OpeningDate.");
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var hasAction = await _workflowActionGrantService.HasRequiredActionAsync(conn, tx, User, "tender", tenderId, "tender.publish", ct);
            if (!hasAction)
            {
                return Forbid();
            }

            var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(conn, tx, "tender", tenderId, "solicitation", ct);
            if (!transition.IsAllowed)
            {
                return BadRequest(transition.Message);
            }

            await using var cmd = new NpgsqlCommand("vendor_sourcing.publish_tender_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);
            cmd.Parameters.AddWithValue("p_publish_date", NpgsqlDbType.Timestamp, (object?)request.PublishDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_opening_date", NpgsqlDbType.Timestamp, (object?)request.OpeningDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_closing_date", NpgsqlDbType.Timestamp, (object?)request.ClosingDate ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapTenderDetail, ct);
            var result = results.FirstOrDefault();
            if (result is null)
            {
                return NotFound();
            }

            await EnsureBidOpeningSessionSeededAsync(conn, tx, result, ct);
            await SyncWorkflowRuntimeAsync(conn, tx, result, "Tender published.", ct);
            await tx.CommitAsync(ct);
            return Ok(result);
        }
        catch (PostgresException ex) when (ex.SqlState == "P0001")
        {
            _logger.LogWarning(ex, "Budget validation failed while publishing tender {TenderId}.", tenderId);
            return Conflict(ex.MessageText);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing tender {TenderId}.", tenderId);
            return Problem("Internal server error publishing tender.");
        }
    }

    [HttpDelete("{tenderId:guid}")]
    public async Task<IActionResult> DeleteTender(Guid tenderId, CancellationToken ct)
    {
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

            var currentStatus = await GetTenderStatusAsync(conn, tx, tenderId, ct);
            if (currentStatus is null)
            {
                return NotFound();
            }

            if (!string.Equals(currentStatus, "Draft", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest("Only draft tenders can be deleted.");
            }

            var hasWorkflowAction = await _workflowActionGrantService.HasRequiredActionAsync(conn, tx, User, "tender", tenderId, "tender.manage", ct);
            if (!hasWorkflowAction)
            {
                var roleActions = await _workflowActionGrantService.GetRoleModuleActionsAsync(connectionString, WorkflowActionGrantService.ResolveRoleKey(User), ct);
                if (!roleActions.Contains("tender.manage", StringComparer.OrdinalIgnoreCase))
                {
                    return Forbid();
                }
            }

            await DeleteTenderWorkflowRuntimeAsync(conn, tx, tenderId, ct);

            await using var cmd = new NpgsqlCommand(@"
DELETE FROM vendor_sourcing.tenders
WHERE tender_id = @p_tender_id
  AND status = 'Draft';", conn, tx);
            cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);

            var deletedRows = await cmd.ExecuteNonQueryAsync(ct);
            if (deletedRows == 0)
            {
                return NotFound();
            }

            await tx.CommitAsync(ct);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting tender {TenderId}.", tenderId);
            return Problem("Internal server error deleting tender.");
        }
    }

    private async Task SyncWorkflowRuntimeAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        TenderDetail tender,
        string reason,
        CancellationToken ct)
    {
        var threshold = await _workflowPolicyGuard.ResolveThresholdAsync(conn, tx, tender.Category, tender.Budget, ct);
        await _workflowRuntimeTracker.SyncAsync(
            conn,
            tx,
            new WorkflowRuntimeSyncRequest(
                "tender",
                tender.TenderId,
                ResolveWorkflowStage(tender.Status),
                tender.Status,
                tender.Title,
                null,
                null,
                tender.Budget,
                tender.Category,
                threshold?.ThresholdId,
                reason,
                null),
            ct);
    }

    private static string ResolveWorkflowStage(string status) => status switch
    {
        "Draft" => "method_validation",
        "Published" => "solicitation",
        "Closed" => "bid_opening",
        "Awarded" => "award_and_publication",
        _ => "solicitation"
    };

    private static async Task<string?> GetTenderStatusAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid tenderId,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(@"
SELECT status
FROM vendor_sourcing.tenders
WHERE tender_id = @p_tender_id
FOR UPDATE;", conn, tx);
        cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);

        var result = await cmd.ExecuteScalarAsync(ct);
        return result as string;
    }

    private static async Task DeleteTenderWorkflowRuntimeAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid tenderId,
        CancellationToken ct)
    {
        await using var historyCmd = new NpgsqlCommand(@"
DELETE FROM procurement_workflow.workflow_instance_history
WHERE instance_id IN (
    SELECT instance_id
    FROM procurement_workflow.workflow_instances
    WHERE entity_type = 'tender'
      AND entity_id = @p_tender_id
);", conn, tx);
        historyCmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);
        await historyCmd.ExecuteNonQueryAsync(ct);

        await using var runtimeCmd = new NpgsqlCommand(@"
DELETE FROM procurement_workflow.workflow_instances
WHERE entity_type = 'tender'
  AND entity_id = @p_tender_id;", conn, tx);
        runtimeCmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);
        await runtimeCmd.ExecuteNonQueryAsync(ct);
    }
}

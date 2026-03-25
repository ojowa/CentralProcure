using System.Data;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class ProcurementPlansController
{
    [HttpPost]
    public async Task<IActionResult> CreatePlan([FromBody] ProcurementPlanCreateRequest request, CancellationToken ct)
    {
        var validationError = ValidateCreateRequest(request, out var normalizedStatus);
        if (validationError is not null)
            return BadRequest(validationError);

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("procurement_workflow.create_procurement_plan_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
            cmd.Parameters.AddWithValue("p_plan_title", NpgsqlDbType.Varchar, request.PlanTitle);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, request.Department);
            cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, request.FiscalYear);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_total_budget", NpgsqlDbType.Numeric, request.TotalBudget);
            cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)request.Notes ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var result = (await ExecuteRefcursorAsync(cmd, MapPlanDetail, ct)).FirstOrDefault();
            if (result is null)
                return Problem("Procurement plan creation failed.");

            await SyncWorkflowRuntimeAsync(conn, tx, result, "Procurement plan created.", ct);
            await tx.CommitAsync(ct);
            return Created($"/api/procurement-plans/{result.PlanId}", result);
        }
        catch (PostgresException ex) when (ex.SqlState == "23505" && ex.ConstraintName == "procurement_plans_unique_title_ux")
        {
            _logger.LogWarning(ex, "Duplicate procurement plan prevented.");
            return Conflict("Procurement plan already exists for this title, department, and fiscal year.");
        }
        catch (PostgresException ex) when (ex.SqlState == "P0001")
        {
            _logger.LogWarning(ex, "Procurement plan validation failed.");
            return Conflict(ex.MessageText);
        }
        catch (PostgresException ex)
        {
            _logger.LogError(ex, "Error creating procurement plan.");
            return BadRequest(ex.MessageText);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating procurement plan.");
            return Problem("Internal server error creating procurement plan.");
        }
    }

    [HttpPut("{planId:guid}")]
    public async Task<IActionResult> UpdatePlan(Guid planId, [FromBody] ProcurementPlanUpdateRequest request, CancellationToken ct)
    {
        if (request is null)
            return BadRequest("Request body is required.");

        var validationError = ValidateUpdateRequest(request, out var normalizedStatus);
        if (validationError is not null)
            return BadRequest(validationError);

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            if (!string.IsNullOrWhiteSpace(normalizedStatus))
            {
                var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(conn, tx, "procurement_plan", planId, ResolveWorkflowStage(normalizedStatus), ct);
                if (!transition.IsAllowed)
                    return BadRequest(transition.Message);
            }

            await using var cmd = new NpgsqlCommand("procurement_workflow.update_procurement_plan_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
            cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
            cmd.Parameters.AddWithValue("p_plan_title", NpgsqlDbType.Varchar, (object?)request.PlanTitle ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)request.Department ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)request.FiscalYear ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_total_budget", NpgsqlDbType.Numeric, (object?)request.TotalBudget ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)request.Notes ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_submitted_at", NpgsqlDbType.Timestamp, (object?)request.SubmittedAt ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_approved_at", NpgsqlDbType.Timestamp, (object?)request.ApprovedAt ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var result = (await ExecuteRefcursorAsync(cmd, MapPlanDetail, ct)).FirstOrDefault();
            if (result is null)
                return NotFound();

            await SyncWorkflowRuntimeAsync(conn, tx, result, "Procurement plan updated.", ct);
            await tx.CommitAsync(ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating procurement plan {PlanId}.", planId);
            return Problem("Internal server error updating procurement plan.");
        }
    }

    [HttpDelete("{planId:guid}")]
    public async Task<IActionResult> DeletePlan(Guid planId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("procurement_workflow.delete_procurement_plan_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
            cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
            var results = await ExecuteRefcursorAsync(cmd, MapPlanDetail, ct);
            await tx.CommitAsync(ct);
            return results.FirstOrDefault() is { } result ? Ok(result) : NotFound();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting procurement plan {PlanId}.", planId);
            return Problem("Internal server error deleting procurement plan.");
        }
    }
}

using System.Data;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class RequisitionsController
{
    [HttpGet]
    public async Task<IActionResult> GetRequisitions(
        [FromQuery] string? status,
        [FromQuery] string? department,
        [FromQuery] string? priority,
        [FromQuery] string? query,
        [FromQuery] DateTime? dateFrom,
        [FromQuery] DateTime? dateTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        [FromQuery] string? sortBy = "created_at",
        [FromQuery] string? sortDir = "desc",
        CancellationToken ct = default)
    {
        if (!IsStatusValid(status, out _))
        {
            return BadRequest($"Status must be one of: {string.Join(", ", AllowedStatuses)}.");
        }

        if (!IsPriorityValid(priority, out _))
        {
            return BadRequest($"Priority must be one of: {string.Join(", ", AllowedPriorities)}.");
        }

        if (page < 1)
        {
            return BadRequest("Page must be 1 or greater.");
        }

        if (pageSize < 1 || pageSize > MaxPageSize)
        {
            return BadRequest($"PageSize must be between 1 and {MaxPageSize}.");
        }

        sortBy = string.IsNullOrWhiteSpace(sortBy) ? "created_at" : sortBy.Trim().ToLowerInvariant();
        sortDir = string.IsNullOrWhiteSpace(sortDir) ? "desc" : sortDir.Trim().ToLowerInvariant();
        if (!AllowedSortFields.Contains(sortBy))
        {
            return BadRequest($"SortBy must be one of: {string.Join(", ", AllowedSortFields)}.");
        }

        if (!AllowedSortDirections.Contains(sortDir))
        {
            return BadRequest("SortDir must be 'asc' or 'desc'.");
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
            var total = await GetRequisitionCountAsync(conn, tx, status, department, priority, query, dateFrom, dateTo, ct);

            await using var cmd = new NpgsqlCommand("procurement_workflow.get_requisitions_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)department ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_priority", NpgsqlDbType.Varchar, (object?)priority ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_date_from", NpgsqlDbType.Timestamp, (object?)dateFrom ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_date_to", NpgsqlDbType.Timestamp, (object?)dateTo ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_sort_by", NpgsqlDbType.Varchar, sortBy);
            cmd.Parameters.AddWithValue("p_sort_dir", NpgsqlDbType.Varchar, sortDir);
            cmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, pageSize);
            cmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, (page - 1) * pageSize);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, MapSummary, ct);
            results = await ApplyFinalCommitteeDecisionsAsync(conn, tx, results, ct);
            await tx.CommitAsync(ct);
            results = await EnrichSummariesWithAuthorityAsync(connectionString, results, ct);

            return Ok(new { Items = results, Page = page, PageSize = pageSize, Total = total });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving requisitions.");
            return Problem("Internal server error retrieving requisitions.");
        }
    }

    [HttpGet("{requisitionId:guid}")]
    public async Task<IActionResult> GetRequisitionDetail(Guid requisitionId, CancellationToken ct)
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
            await using var cmd = new NpgsqlCommand("procurement_workflow.get_requisition_detail_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var details = await ExecuteRefcursorAsync(cmd, MapDetailWithoutItems, ct);
            var detail = (await ApplyFinalCommitteeDecisionsAsync(conn, tx, details, ct)).FirstOrDefault();
            if (detail is null)
            {
                return NotFound();
            }

            var lineItems = await GetLineItemsAsync(conn, tx, requisitionId, ct);
            await tx.CommitAsync(ct);

            var enriched = await EnrichDetailWithAuthorityAsync(connectionString, detail with { LineItems = lineItems }, ct);
            enriched = await EnrichDetailWithRoutingAsync(connectionString, enriched, ct);
            return Ok(enriched);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving requisition {RequisitionId}.", requisitionId);
            return Problem("Internal server error retrieving requisition.");
        }
    }
}

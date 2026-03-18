using System.Data;
using eProcurement.Modules.VendorSourcing.DTOs;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.VendorSourcing.Controllers;

public partial class BidOpeningController
{
    [HttpGet("sessions")]
    public async Task<IActionResult> GetSessions(
        [FromQuery] string? status,
        [FromQuery] Guid? tenderId,
        [FromQuery] string? query,
        [FromQuery] DateTime? dateFrom,
        [FromQuery] DateTime? dateTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        [FromQuery] string? sortBy = "scheduled_at",
        [FromQuery] string? sortDir = "asc",
        CancellationToken ct = default)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        var actions = await _workflowActionGrantService.GetRoleModuleActionsAsync(connectionString, WorkflowActionGrantService.ResolveRoleKey(User), ct);
        if (!actions.Contains("bid_opening.manage") && !actions.Contains("bid_opening.view_detail"))
        {
            return Forbid();
        }

        if (!IsStatusValid(status, out _))
        {
            return BadRequest($"Status must be one of: {string.Join(", ", AllowedStatuses)}.");
        }

        if (dateFrom.HasValue && dateTo.HasValue && dateTo.Value < dateFrom.Value)
        {
            return BadRequest("DateTo cannot be earlier than DateFrom.");
        }

        if (page < 1)
        {
            return BadRequest("Page must be 1 or greater.");
        }

        if (pageSize < 1 || pageSize > MaxPageSize)
        {
            return BadRequest($"PageSize must be between 1 and {MaxPageSize}.");
        }

        sortBy = string.IsNullOrWhiteSpace(sortBy) ? "scheduled_at" : sortBy.Trim().ToLowerInvariant();
        sortDir = string.IsNullOrWhiteSpace(sortDir) ? "asc" : sortDir.Trim().ToLowerInvariant();

        if (!AllowedSortFields.Contains(sortBy))
        {
            return BadRequest($"SortBy must be one of: {string.Join(", ", AllowedSortFields)}.");
        }

        if (!AllowedSortDirections.Contains(sortDir))
        {
            return BadRequest("SortDir must be 'asc' or 'desc'.");
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var total = await GetSessionCountAsync(conn, tx, status, tenderId, query, dateFrom, dateTo, ct);

            await using var cmd = new NpgsqlCommand("vendor_sourcing.get_bid_opening_sessions_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, (object?)tenderId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_date_from", NpgsqlDbType.Timestamp, (object?)dateFrom ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_date_to", NpgsqlDbType.Timestamp, (object?)dateTo ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_sort_by", NpgsqlDbType.Varchar, sortBy);
            cmd.Parameters.AddWithValue("p_sort_dir", NpgsqlDbType.Varchar, sortDir);
            cmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, pageSize);
            cmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, (page - 1) * pageSize);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var items = await ExecuteRefcursorAsync(cmd, MapSummary, ct);
            await tx.CommitAsync(ct);

            return Ok(new BidOpeningSessionListResponse(items, page, pageSize, total));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving bid opening sessions.");
            return Problem("Internal server error retrieving bid opening sessions.");
        }
    }

    [HttpGet("sessions/{sessionId:guid}")]
    public async Task<IActionResult> GetSession(Guid sessionId, CancellationToken ct)
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

            var session = await GetSessionDetailAsync(sessionId, conn, tx, ct);
            if (session is null)
            {
                return NotFound();
            }

            var hasAction = await _workflowActionGrantService.HasRequiredActionAsync(
                conn,
                tx,
                User,
                "bid_opening_session",
                sessionId,
                "bid_opening.view_detail",
                ct);

            if (!hasAction)
            {
                return Forbid();
            }

            return Ok(session);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving bid opening session {SessionId}.", sessionId);
            return Problem("Internal server error retrieving bid opening session.");
        }
    }
}

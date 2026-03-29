using System.Data;
using eProcurement.Modules.VendorSourcing.DTOs;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.VendorSourcing.Controllers;

public partial class BidOpeningController
{
    [HttpPost("sessions")]
    public async Task<IActionResult> CreateSession([FromBody] BidOpeningSessionCreateRequest request, CancellationToken ct)
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

            var tender = await GetTenderScheduleAsync(request.TenderId, conn, tx, ct);
            if (tender is null)
            {
                return NotFound(new { message = "Tender not found." });
            }

            var hasAction = await _workflowActionGrantService.HasRequiredActionAsync(
                conn,
                tx,
                User,
                "tender",
                request.TenderId,
                "bid_opening.manage",
                ct);

            if (!hasAction)
            {
                var roleKey = eProcurement.Shared.Workflow.WorkflowActionGrantService.ResolveRoleKey(User) ?? "unresolved";
                var snapshot = await _workflowRuntimeTracker.GetAsync(
                    GetConnectionString(),
                    "tender",
                    request.TenderId,
                    ct);
                _logger.LogWarning(
                    "Bid opening session create forbidden for tender {TenderId}. Role={RoleKey}, Stage={StageKey}, Status={Status}, User={UserName}.",
                    request.TenderId,
                    roleKey,
                    snapshot?.CurrentStageKey ?? "unknown",
                    snapshot?.CurrentStatus ?? "unknown",
                    User.Identity?.Name ?? User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "anonymous");
                return Forbid();
            }

            var createAlignmentError = ValidatePpaAlignedState(
                new BidOpeningValidationState(
                    request.TenderId,
                    request.ScheduledAt,
                    normalizedStatus ?? "Scheduled",
                    request.Location,
                    request.OpenedAt,
                    request.ClosedAt,
                    request.Notes),
                tender);

            if (createAlignmentError is not null)
            {
                return BadRequest(createAlignmentError);
            }

            await using var cmd = new NpgsqlCommand("vendor_sourcing.create_bid_opening_session_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, request.TenderId);
            cmd.Parameters.AddWithValue("p_session_title", NpgsqlDbType.Varchar, request.SessionTitle);
            cmd.Parameters.AddWithValue("p_location", NpgsqlDbType.Varchar, (object?)request.Location ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_scheduled_at", NpgsqlDbType.Timestamp, request.ScheduledAt);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_opened_at", NpgsqlDbType.Timestamp, (object?)request.OpenedAt ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_closed_at", NpgsqlDbType.Timestamp, (object?)request.ClosedAt ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)request.Notes ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapDetail, ct);
            var result = results.FirstOrDefault();
            if (result is null)
            {
                return Problem("Bid opening session creation failed.");
            }

            await SyncWorkflowRuntimeAsync(conn, tx, result, "Bid opening session created.", ct);
            await tx.CommitAsync(ct);
            return Created($"/api/bid-opening/sessions/{result.SessionId}", result);
        }
        catch (PostgresException ex) when (ex.SqlState == "23514")
        {
            _logger.LogWarning(ex, "Bid opening session state validation failed during create.");
            return BadRequest(ex.MessageText);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating bid opening session.");
            return Problem("Internal server error creating bid opening session.");
        }
    }

    [HttpPut("sessions/{sessionId:guid}")]
    public async Task<IActionResult> UpdateSession(Guid sessionId, [FromBody] BidOpeningSessionUpdateRequest request, CancellationToken ct)
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

            var existingSession = await GetSessionDetailAsync(sessionId, conn, tx, ct);
            if (existingSession is null)
            {
                return NotFound();
            }

            var hasAction = await _workflowActionGrantService.HasRequiredActionAsync(
                conn,
                tx,
                User,
                "bid_opening_session",
                sessionId,
                "bid_opening.manage",
                ct);

            if (!hasAction)
            {
                var roleKey = eProcurement.Shared.Workflow.WorkflowActionGrantService.ResolveRoleKey(User) ?? "unresolved";
                var snapshot = await _workflowRuntimeTracker.GetAsync(
                    GetConnectionString(),
                    "bid_opening_session",
                    sessionId,
                    ct);
                _logger.LogWarning(
                    "Bid opening session update forbidden for session {SessionId}. Role={RoleKey}, Stage={StageKey}, Status={Status}, User={UserName}.",
                    sessionId,
                    roleKey,
                    snapshot?.CurrentStageKey ?? "unknown",
                    snapshot?.CurrentStatus ?? "unknown",
                    User.Identity?.Name ?? User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "anonymous");
                return Forbid();
            }

            var tender = await GetTenderScheduleAsync(existingSession.TenderId, conn, tx, ct);
            if (tender is null)
            {
                return NotFound(new { message = "Tender not found." });
            }

            var effectiveState = new BidOpeningValidationState(
                existingSession.TenderId,
                request.ScheduledAt ?? existingSession.ScheduledAt,
                normalizedStatus ?? existingSession.Status,
                request.Location ?? existingSession.Location,
                request.OpenedAt ?? existingSession.OpenedAt,
                request.ClosedAt ?? existingSession.ClosedAt,
                request.Notes ?? existingSession.Notes);

            var updateAlignmentError = ValidatePpaAlignedState(effectiveState, tender);
            if (updateAlignmentError is not null)
            {
                return BadRequest(updateAlignmentError);
            }

            await using var cmd = new NpgsqlCommand("vendor_sourcing.update_bid_opening_session_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_session_id", NpgsqlDbType.Uuid, sessionId);
            cmd.Parameters.AddWithValue("p_session_title", NpgsqlDbType.Varchar, (object?)request.SessionTitle ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_location", NpgsqlDbType.Varchar, (object?)request.Location ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_scheduled_at", NpgsqlDbType.Timestamp, (object?)request.ScheduledAt ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_opened_at", NpgsqlDbType.Timestamp, (object?)request.OpenedAt ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_closed_at", NpgsqlDbType.Timestamp, (object?)request.ClosedAt ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)request.Notes ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapDetail, ct);
            var result = results.FirstOrDefault();
            if (result is null)
            {
                return NotFound();
            }

            await SyncWorkflowRuntimeAsync(conn, tx, result, "Bid opening session updated.", ct);
            await tx.CommitAsync(ct);
            return Ok(result);
        }
        catch (PostgresException ex) when (ex.SqlState == "23514")
        {
            _logger.LogWarning(ex, "Bid opening session state validation failed during update for {SessionId}.", sessionId);
            return BadRequest(ex.MessageText);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating bid opening session {SessionId}.", sessionId);
            return Problem("Internal server error updating bid opening session.");
        }
    }
}

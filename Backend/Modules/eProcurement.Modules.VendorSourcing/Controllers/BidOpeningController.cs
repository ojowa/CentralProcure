using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.VendorSourcing.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.VendorSourcing.Controllers;

[ApiController]
[Authorize]
[Route("api/bid-opening")]
public class BidOpeningController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<BidOpeningController> _logger;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private readonly WorkflowActionGrantService _workflowActionGrantService;

    private static readonly string[] AllowedStatuses = { "Scheduled", "Open", "Closed", "Cancelled" };
    private static readonly HashSet<string> AllowedSortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "scheduled_at",
        "session_title",
        "status",
        "created_at",
        "location"
    };
    private static readonly HashSet<string> AllowedSortDirections = new(StringComparer.OrdinalIgnoreCase) { "asc", "desc" };
    private static readonly HashSet<string> ReadRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "procurement_officer",
        "technical_evaluator",
        "financial_evaluator",
        "evaluation_committee",
        "tenders_board",
        "accounting_officer",
        "bpp_reviewer",
        "audit_oversight",
        "ict_admin"
    };
    private static readonly HashSet<string> ManageRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "procurement_officer",
        "ict_admin"
    };
    private static readonly Dictionary<string, string> RoleAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["admin"] = "ict_admin",
        ["system_administrator"] = "ict_admin",
        ["tenders_board_member"] = "tenders_board",
        ["tenders_board_secretary"] = "tenders_board",
        ["audit_officer"] = "audit_oversight",
        ["bpp_liaison"] = "bpp_reviewer"
    };
    private const int DefaultPageSize = 10;
    private const int MaxPageSize = 100;

    public BidOpeningController(
        IConfiguration config,
        ILogger<BidOpeningController> logger,
        WorkflowRuntimeTracker workflowRuntimeTracker,
        WorkflowActionGrantService workflowActionGrantService)
    {
        _config = config;
        _logger = logger;
        _workflowRuntimeTracker = workflowRuntimeTracker;
        _workflowActionGrantService = workflowActionGrantService;
    }

    private sealed record TenderScheduleContext(Guid TenderId, string Status, DateTime? OpeningDate, DateTime? ClosingDate);
    private sealed record BidOpeningValidationState(
        Guid TenderId,
        DateTime ScheduledAt,
        string Status,
        string? Location,
        DateTime? OpenedAt,
        DateTime? ClosedAt,
        string? Notes);

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

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

    private static async Task<List<T>> ExecuteRefcursorAsync<T>(NpgsqlCommand cmd, Func<NpgsqlDataReader, T> map, CancellationToken ct)
    {
        await cmd.ExecuteNonQueryAsync(ct);
        var cursorName = (string)cmd.Parameters["p_result"].Value!;
        await using var fetch = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", cmd.Connection!, cmd.Transaction);
        await using var reader = await fetch.ExecuteReaderAsync(ct);

        var results = new List<T>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(map(reader));
        }

        return results;
    }

    private static BidOpeningSessionSummary MapSummary(NpgsqlDataReader r)
    {
        return new BidOpeningSessionSummary(
            r.GetGuid(r.GetOrdinal("session_id")),
            r.GetGuid(r.GetOrdinal("tender_id")),
            r.GetString(r.GetOrdinal("session_title")),
            GetNullableString(r, "location"),
            r.GetDateTime(r.GetOrdinal("scheduled_at")),
            r.GetString(r.GetOrdinal("status")),
            GetNullableDateTime(r, "opened_at"),
            GetNullableDateTime(r, "closed_at"),
            r.GetDateTime(r.GetOrdinal("created_at")));
    }

    private static BidOpeningSessionDetail MapDetail(NpgsqlDataReader r)
    {
        return new BidOpeningSessionDetail(
            r.GetGuid(r.GetOrdinal("session_id")),
            r.GetGuid(r.GetOrdinal("tender_id")),
            r.GetString(r.GetOrdinal("session_title")),
            GetNullableString(r, "location"),
            r.GetDateTime(r.GetOrdinal("scheduled_at")),
            r.GetString(r.GetOrdinal("status")),
            GetNullableDateTime(r, "opened_at"),
            GetNullableDateTime(r, "closed_at"),
            GetNullableString(r, "notes"),
            r.GetDateTime(r.GetOrdinal("created_at")),
            r.GetDateTime(r.GetOrdinal("updated_at")));
    }

    private static string? GetNullableString(NpgsqlDataReader r, string n)
    {
        var ordinal = r.GetOrdinal(n);
        return r.IsDBNull(ordinal) ? null : r.GetString(ordinal);
    }

    private static DateTime? GetNullableDateTime(NpgsqlDataReader r, string n)
    {
        var ordinal = r.GetOrdinal(n);
        return r.IsDBNull(ordinal) ? null : r.GetDateTime(ordinal);
    }

    private static bool IsStatusValid(string? status, out string? normalized)
    {
        normalized = null;
        if (string.IsNullOrWhiteSpace(status))
        {
            return true;
        }

        var trimmed = status.Trim();
        var match = AllowedStatuses.FirstOrDefault(s => string.Equals(s, trimmed, StringComparison.OrdinalIgnoreCase));
        if (match is null)
        {
            return false;
        }

        normalized = match;
        return true;
    }

    private async Task SyncWorkflowRuntimeAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        BidOpeningSessionDetail session,
        string reason,
        CancellationToken ct)
    {
        await _workflowRuntimeTracker.SyncAsync(
            conn,
            tx,
            new WorkflowRuntimeSyncRequest(
                "bid_opening_session",
                session.SessionId,
                "bid_opening",
                session.Status,
                session.SessionTitle,
                "tender",
                session.TenderId,
                null,
                null,
                null,
                reason,
                null),
            ct);
    }

    private static string? ValidatePpaAlignedState(BidOpeningValidationState state, TenderScheduleContext tender)
    {
        if (!string.Equals(tender.Status, "Published", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(tender.Status, "Closed", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(tender.Status, "Awarded", StringComparison.OrdinalIgnoreCase))
        {
            return "Bid opening sessions can only be managed for tenders that have reached the published procurement stage.";
        }

        if (string.IsNullOrWhiteSpace(state.Location))
        {
            return "Location is required to support a public bid opening record.";
        }

        if (!tender.ClosingDate.HasValue)
        {
            return "Tender closing date must be defined before a bid opening session can be recorded.";
        }

        if (state.ScheduledAt < tender.ClosingDate.Value)
        {
            return "ScheduledAt cannot be earlier than the tender closing date.";
        }

        if (state.OpenedAt.HasValue && state.OpenedAt.Value < tender.ClosingDate.Value)
        {
            return "OpenedAt cannot be earlier than the tender closing date.";
        }

        switch (state.Status)
        {
            case "Scheduled":
                if (state.OpenedAt.HasValue || state.ClosedAt.HasValue)
                {
                    return "Scheduled sessions cannot carry opening or closing timestamps yet.";
                }
                break;
            case "Open":
                if (!state.OpenedAt.HasValue)
                {
                    return "OpenedAt is required once a bid opening session is marked Open.";
                }

                if (state.ClosedAt.HasValue)
                {
                    return "ClosedAt must remain empty while a bid opening session is still Open.";
                }
                break;
            case "Closed":
                if (!state.OpenedAt.HasValue || !state.ClosedAt.HasValue)
                {
                    return "Closed sessions must include both OpenedAt and ClosedAt.";
                }

                if (state.ClosedAt.Value < state.OpenedAt.Value)
                {
                    return "ClosedAt cannot be earlier than OpenedAt.";
                }
                break;
            case "Cancelled":
                if (state.OpenedAt.HasValue || state.ClosedAt.HasValue)
                {
                    return "Cancelled sessions cannot carry opening or closing timestamps.";
                }

                if (string.IsNullOrWhiteSpace(state.Notes))
                {
                    return "Cancellation notes are required for a cancelled bid opening session.";
                }
                break;
        }

        return null;
    }

    private static async Task<BidOpeningSessionDetail?> GetSessionDetailAsync(
        Guid sessionId,
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("vendor_sourcing.get_bid_opening_session_details_sp", conn, tx)
        {
            CommandType = CommandType.StoredProcedure
        };

        cmd.Parameters.AddWithValue("p_session_id", NpgsqlDbType.Uuid, sessionId);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
        {
            Direction = ParameterDirection.Output
        });

        var results = await ExecuteRefcursorAsync(cmd, MapDetail, ct);
        return results.FirstOrDefault();
    }

    private static async Task<TenderScheduleContext?> GetTenderScheduleAsync(
        Guid tenderId,
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("vendor_sourcing.get_tender_details_sp", conn, tx)
        {
            CommandType = CommandType.StoredProcedure
        };

        cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
        {
            Direction = ParameterDirection.Output
        });

        var results = await ExecuteRefcursorAsync(
            cmd,
            reader => new TenderScheduleContext(
                reader.GetGuid(reader.GetOrdinal("tender_id")),
                reader.GetString(reader.GetOrdinal("status")),
                GetNullableDateTime(reader, "opening_date"),
                GetNullableDateTime(reader, "closing_date")),
            ct);

        return results.FirstOrDefault();
    }

    private static string? ValidateCreateRequest(BidOpeningSessionCreateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = null;

        if (request.TenderId == Guid.Empty)
        {
            return "TenderId is required.";
        }

        if (string.IsNullOrWhiteSpace(request.SessionTitle) || request.SessionTitle.Trim().Length < 5)
        {
            return "SessionTitle must be at least 5 characters.";
        }

        if (request.ScheduledAt == default)
        {
            return "ScheduledAt is required.";
        }

        if (!IsStatusValid(request.Status, out normalizedStatus))
        {
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
        }

        if (request.OpenedAt.HasValue && request.OpenedAt.Value < request.ScheduledAt)
        {
            return "OpenedAt cannot be earlier than ScheduledAt.";
        }

        if (request.OpenedAt.HasValue && request.ClosedAt.HasValue && request.ClosedAt.Value < request.OpenedAt.Value)
        {
            return "ClosedAt cannot be earlier than OpenedAt.";
        }

        return null;
    }

    private static string? ValidateUpdateRequest(BidOpeningSessionUpdateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = null;

        var hasAny =
            request.SessionTitle is not null ||
            request.Location is not null ||
            request.ScheduledAt.HasValue ||
            request.Status is not null ||
            request.OpenedAt.HasValue ||
            request.ClosedAt.HasValue ||
            request.Notes is not null;

        if (!hasAny)
        {
            return "At least one field is required to update a session.";
        }

        if (request.SessionTitle is not null && request.SessionTitle.Trim().Length < 5)
        {
            return "SessionTitle must be at least 5 characters.";
        }

        if (!IsStatusValid(request.Status, out normalizedStatus))
        {
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
        }

        if (request.OpenedAt.HasValue && request.ScheduledAt.HasValue && request.OpenedAt.Value < request.ScheduledAt.Value)
        {
            return "OpenedAt cannot be earlier than ScheduledAt.";
        }

        if (request.OpenedAt.HasValue && request.ClosedAt.HasValue && request.ClosedAt.Value < request.OpenedAt.Value)
        {
            return "ClosedAt cannot be earlier than OpenedAt.";
        }

        return null;
    }

    private static async Task<long> GetSessionCountAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string? status,
        Guid? tenderId,
        string? query,
        DateTime? dateFrom,
        DateTime? dateTo,
        CancellationToken ct)
    {
        const string sql = "SELECT vendor_sourcing.get_bid_opening_sessions_count(@p_status, @p_tender_id, @p_query, @p_date_from, @p_date_to);";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, (object?)tenderId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_date_from", NpgsqlDbType.Timestamp, (object?)dateFrom ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_date_to", NpgsqlDbType.Timestamp, (object?)dateTo ?? DBNull.Value);

        var result = await cmd.ExecuteScalarAsync(ct);
        return result is null ? 0 : Convert.ToInt64(result);
    }
}

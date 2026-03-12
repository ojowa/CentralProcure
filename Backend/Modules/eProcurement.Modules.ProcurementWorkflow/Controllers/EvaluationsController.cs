using Microsoft.AspNetCore.Mvc;
using System.Linq;
using Npgsql;
using eProcurement.Modules.ProcurementWorkflow.DTOs;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/evaluations")]
public class EvaluationsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<EvaluationsController> _logger;

    public EvaluationsController(IConfiguration config, ILogger<EvaluationsController> logger)
    {
        _config = config;
        _logger = logger;
    }

    [HttpGet("assigned-tenders/{assignmentKey?}")]
    public async Task<IActionResult> GetAssignedTenders(string? assignmentKey, CancellationToken ct)
    {
        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
SELECT
    r.report_code,
    r.tender_id,
    r.tender_title,
    r.committee_lead,
    r.status AS evaluation_status,
    r.submitted_at,
    t.category AS procurement_category,
    t.status AS tender_status,
    t.closing_date,
    t.opening_date,
    CASE
        WHEN to_regclass('procurement_workflow.evaluation_actions') IS NULL THEN FALSE
        ELSE EXISTS (
            SELECT 1
            FROM procurement_workflow.evaluation_actions a
            WHERE a.tender_id = r.tender_id
              AND a.action_type = 'ConflictOfInterest'
        )
    END AS is_locked
FROM procurement_workflow.evaluation_reports r
LEFT JOIN vendor_sourcing.tenders t ON t.tender_id = r.tender_id
ORDER BY r.submitted_at DESC;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);

            var results = new List<AssignedTenderItem>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                results.Add(new AssignedTenderItem(
                    reader.GetString(reader.GetOrdinal("report_code")),
                    reader.GetGuid(reader.GetOrdinal("tender_id")),
                    reader.GetString(reader.GetOrdinal("tender_title")),
                    reader.GetString(reader.GetOrdinal("committee_lead")),
                    reader.GetString(reader.GetOrdinal("evaluation_status")),
                    reader.IsDBNull(reader.GetOrdinal("tender_status")) ? "Unknown" : reader.GetString(reader.GetOrdinal("tender_status")),
                    reader.IsDBNull(reader.GetOrdinal("procurement_category")) ? "Unspecified" : reader.GetString(reader.GetOrdinal("procurement_category")),
                    reader.IsDBNull(reader.GetOrdinal("closing_date")) ? null : reader.GetDateTime(reader.GetOrdinal("closing_date")),
                    reader.IsDBNull(reader.GetOrdinal("opening_date")) ? null : reader.GetDateTime(reader.GetOrdinal("opening_date")),
                    reader.GetDateTime(reader.GetOrdinal("submitted_at")),
                    reader.GetBoolean(reader.GetOrdinal("is_locked"))
                ));
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting assigned tenders for key {AssignmentKey}.", assignmentKey);
            return Problem("Internal server error retrieving assigned tenders.");
        }
    }

    [HttpPost("actions")]
    public async Task<IActionResult> LogEvaluationAction([FromBody] EvaluationActionRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ActionType))
        {
            return BadRequest(new { message = "ActionType is required." });
        }

        if (request.TenderId == Guid.Empty)
        {
            return BadRequest(new { message = "TenderId is required." });
        }

        var actionType = request.ActionType.Trim();
        var allowedActions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "RequestClarification",
            "RecordNonCompliance",
            "ConflictOfInterest",
            "RecommendAward",
            "RecommendReTender",
            "EscalateToBoard",
            "StartEvaluation"
        };

        if (!allowedActions.Contains(actionType))
        {
            return BadRequest(new { message = "Unsupported ActionType." });
        }

        actionType = allowedActions.First(value => string.Equals(value, actionType, StringComparison.OrdinalIgnoreCase));
        var requiresReason = actionType is "RecordNonCompliance" or "ConflictOfInterest";
        var requiresNotes = actionType is "RequestClarification";
        var requiresJustification = actionType is "RecommendAward" or "RecommendReTender";
        var requiresThreshold = actionType is "EscalateToBoard";

        if (requiresReason && string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { message = "Reason is required for this action." });
        }

        if (requiresNotes && string.IsNullOrWhiteSpace(request.Notes))
        {
            return BadRequest(new { message = "Clarification notes are required." });
        }

        if (requiresJustification && string.IsNullOrWhiteSpace(request.Justification))
        {
            return BadRequest(new { message = "Justification is required for this action." });
        }

        if (requiresThreshold && string.IsNullOrWhiteSpace(request.ThresholdNote))
        {
            return BadRequest(new { message = "Threshold note is required for escalation." });
        }

        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
INSERT INTO procurement_workflow.evaluation_actions (
    action_type,
    report_code,
    tender_id,
    notes,
    reason,
    justification,
    recommendation,
    threshold_note,
    requested_by
)
VALUES (
    @action_type,
    @report_code,
    @tender_id,
    @notes,
    @reason,
    @justification,
    @recommendation,
    @threshold_note,
    @requested_by
)
RETURNING action_id;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("action_type", actionType);
            cmd.Parameters.AddWithValue("report_code", (object?)request.ReportCode ?? DBNull.Value);
            cmd.Parameters.AddWithValue("tender_id", request.TenderId);
            cmd.Parameters.AddWithValue("notes", (object?)request.Notes ?? DBNull.Value);
            cmd.Parameters.AddWithValue("reason", (object?)request.Reason ?? DBNull.Value);
            cmd.Parameters.AddWithValue("justification", (object?)request.Justification ?? DBNull.Value);
            cmd.Parameters.AddWithValue("recommendation", (object?)request.Recommendation ?? DBNull.Value);
            cmd.Parameters.AddWithValue("threshold_note", (object?)request.ThresholdNote ?? DBNull.Value);
            cmd.Parameters.AddWithValue("requested_by", (object?)request.RequestedBy ?? DBNull.Value);

            var actionId = (Guid?)await cmd.ExecuteScalarAsync(ct);

            return Ok(new { actionId, status = "logged" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error logging evaluation action {ActionType} for tender {TenderId}.", actionType, request.TenderId);
            return Problem("Internal server error logging evaluation action.");
        }
    }
}

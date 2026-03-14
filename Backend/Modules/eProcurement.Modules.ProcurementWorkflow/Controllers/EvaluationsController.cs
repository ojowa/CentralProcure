using Microsoft.AspNetCore.Mvc;
using System.Linq;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/evaluations")]
public class EvaluationsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<EvaluationsController> _logger;
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private readonly WorkflowActionGrantService _workflowActionGrantService;

    public EvaluationsController(
        IConfiguration config,
        ILogger<EvaluationsController> logger,
        WorkflowPolicyGuard workflowPolicyGuard,
        WorkflowRuntimeTracker workflowRuntimeTracker,
        WorkflowActionGrantService workflowActionGrantService)
    {
        _config = config;
        _logger = logger;
        _workflowPolicyGuard = workflowPolicyGuard;
        _workflowRuntimeTracker = workflowRuntimeTracker;
        _workflowActionGrantService = workflowActionGrantService;
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
        if (request is null)
        {
            return BadRequest(new { message = "Request body is required." });
        }

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
            await using var tx = await conn.BeginTransactionAsync(ct);

            var workflowMovement = ResolveWorkflowMovement(actionType);
            WorkflowInstanceState? currentTenderWorkflow = null;
            if (workflowMovement is not null)
            {
                var hasAction = await _workflowActionGrantService.HasRequiredActionAsync(
                    conn,
                    tx,
                    User,
                    "tender",
                    request.TenderId,
                    "evaluation.actions",
                    ct);

                if (!hasAction)
                {
                    return Forbid();
                }

                currentTenderWorkflow = await GetWorkflowInstanceAsync(conn, tx, "tender", request.TenderId, ct);
                if (currentTenderWorkflow is null)
                {
                    return NotFound(new { message = "Tender workflow record was not found." });
                }

                var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(
                    conn,
                    tx,
                    "tender",
                    request.TenderId,
                    workflowMovement.StageKey,
                    ct);

                if (!transition.IsAllowed)
                {
                    return BadRequest(new { message = transition.Message });
                }
            }

            await using var cmd = new NpgsqlCommand(sql, conn, tx);
            cmd.Parameters.AddWithValue("action_type", NpgsqlDbType.Varchar, actionType);
            cmd.Parameters.AddWithValue("report_code", NpgsqlDbType.Varchar, (object?)request.ReportCode ?? DBNull.Value);
            cmd.Parameters.AddWithValue("tender_id", NpgsqlDbType.Uuid, request.TenderId);
            cmd.Parameters.AddWithValue("notes", NpgsqlDbType.Text, (object?)request.Notes ?? DBNull.Value);
            cmd.Parameters.AddWithValue("reason", NpgsqlDbType.Text, (object?)request.Reason ?? DBNull.Value);
            cmd.Parameters.AddWithValue("justification", NpgsqlDbType.Text, (object?)request.Justification ?? DBNull.Value);
            cmd.Parameters.AddWithValue("recommendation", NpgsqlDbType.Varchar, (object?)request.Recommendation ?? DBNull.Value);
            cmd.Parameters.AddWithValue("threshold_note", NpgsqlDbType.Text, (object?)request.ThresholdNote ?? DBNull.Value);
            cmd.Parameters.AddWithValue("requested_by", NpgsqlDbType.Varchar, (object?)request.RequestedBy ?? DBNull.Value);

            var actionId = (Guid?)await cmd.ExecuteScalarAsync(ct);

            if (workflowMovement is not null && currentTenderWorkflow is not null)
            {
                await _workflowRuntimeTracker.SyncAsync(
                    conn,
                    tx,
                    new WorkflowRuntimeSyncRequest(
                        currentTenderWorkflow.EntityType,
                        currentTenderWorkflow.EntityId,
                        workflowMovement.StageKey,
                        currentTenderWorkflow.CurrentStatus,
                        currentTenderWorkflow.RecordTitle,
                        currentTenderWorkflow.ParentEntityType,
                        currentTenderWorkflow.ParentEntityId,
                        currentTenderWorkflow.Amount,
                        currentTenderWorkflow.ProcurementType,
                        currentTenderWorkflow.ThresholdId,
                        workflowMovement.Reason,
                        NormalizeNullable(request.RequestedBy),
                        "evaluation_action"),
                    ct);
            }

            await tx.CommitAsync(ct);

            return Ok(new { actionId, status = "logged" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error logging evaluation action {ActionType} for tender {TenderId}.", actionType, request.TenderId);
            return Problem("Internal server error logging evaluation action.");
        }
    }

    private static WorkflowMovement? ResolveWorkflowMovement(string actionType)
    {
        return actionType switch
        {
            "StartEvaluation" => new WorkflowMovement("evaluation", "Evaluation started from bid opening."),
            "EscalateToBoard" => new WorkflowMovement("tenders_board_review", "Evaluation escalated to Tenders Board review."),
            "RecommendAward" => new WorkflowMovement("tenders_board_review", "Evaluation recommendation submitted for Tenders Board review."),
            _ => null
        };
    }

    private static async Task<WorkflowInstanceState?> GetWorkflowInstanceAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    parent_entity_type,
    parent_entity_id,
    amount,
    procurement_type,
    threshold_id
FROM procurement_workflow.workflow_instances
WHERE entity_type = @p_entity_type
  AND entity_id = @p_entity_id
FOR UPDATE;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, entityType);
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new WorkflowInstanceState(
            reader.GetString(reader.GetOrdinal("entity_type")),
            reader.GetGuid(reader.GetOrdinal("entity_id")),
            reader.GetString(reader.GetOrdinal("current_stage_key")),
            reader.IsDBNull(reader.GetOrdinal("current_status")) ? null : reader.GetString(reader.GetOrdinal("current_status")),
            reader.IsDBNull(reader.GetOrdinal("record_title")) ? null : reader.GetString(reader.GetOrdinal("record_title")),
            reader.IsDBNull(reader.GetOrdinal("parent_entity_type")) ? null : reader.GetString(reader.GetOrdinal("parent_entity_type")),
            reader.IsDBNull(reader.GetOrdinal("parent_entity_id")) ? null : reader.GetGuid(reader.GetOrdinal("parent_entity_id")),
            reader.IsDBNull(reader.GetOrdinal("amount")) ? null : reader.GetFieldValue<decimal>(reader.GetOrdinal("amount")),
            reader.IsDBNull(reader.GetOrdinal("procurement_type")) ? null : reader.GetString(reader.GetOrdinal("procurement_type")),
            reader.IsDBNull(reader.GetOrdinal("threshold_id")) ? null : reader.GetGuid(reader.GetOrdinal("threshold_id")));
    }

    private static string? NormalizeNullable(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed record WorkflowMovement(string StageKey, string Reason);

    private sealed record WorkflowInstanceState(
        string EntityType,
        Guid EntityId,
        string CurrentStageKey,
        string? CurrentStatus,
        string? RecordTitle,
        string? ParentEntityType,
        Guid? ParentEntityId,
        decimal? Amount,
        string? ProcurementType,
        Guid? ThresholdId);
}

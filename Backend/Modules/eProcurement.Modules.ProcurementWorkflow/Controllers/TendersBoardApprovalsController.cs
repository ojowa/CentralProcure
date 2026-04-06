using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Authorize]
[Route("api/tenders-board-approvals")]
public class TendersBoardApprovalsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<TendersBoardApprovalsController> _logger;
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private readonly WorkflowActionGrantService _workflowActionGrantService;

    public TendersBoardApprovalsController(
        IConfiguration config,
        ILogger<TendersBoardApprovalsController> logger,
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

    [HttpGet("queue")]
    public async Task<IActionResult> GetQueue(CancellationToken ct)
    {
        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
SELECT
    wi.instance_id,
    wi.entity_id AS tender_id,
    COALESCE(wi.record_title, t.title, 'Untitled Tender') AS tender_title,
    t.department,
    wi.amount,
    wi.procurement_type,
    threshold.approval_route,
    threshold.approval_authority_label,
    COALESCE(threshold.requires_bpp, FALSE) AS requires_bpp,
    wi.current_status AS status,
    vendor.company_name AS vendor_name,
    report.report_code,
    report.recommendation,
    report.score_summary,
    report.submitted_at AS report_submitted_at,
    wi.created_at,
    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - wi.created_at))::int AS days_pending
FROM procurement_workflow.workflow_instances wi
LEFT JOIN vendor_sourcing.tenders t
    ON t.tender_id = wi.entity_id
LEFT JOIN procurement_workflow.approval_thresholds threshold
    ON threshold.threshold_id = wi.threshold_id
LEFT JOIN LATERAL (
    SELECT report_code, recommendation, score_summary, submitted_at
    FROM procurement_workflow.evaluation_reports
    WHERE tender_id = wi.entity_id
    ORDER BY submitted_at DESC
    LIMIT 1
) report ON TRUE
LEFT JOIN vendor_sourcing.bids bid
    ON bid.tender_id = wi.entity_id
   AND bid.status = 'Recommended'
LEFT JOIN identity.vendors vendor
    ON vendor.vendor_id = bid.vendor_id
WHERE wi.entity_type = 'tender'
  AND wi.current_stage_key = 'tenders_board_review'
ORDER BY wi.created_at DESC;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);

            var results = new List<TendersBoardQueueItemDto>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                results.Add(new TendersBoardQueueItemDto(
                    reader.GetGuid(reader.GetOrdinal("instance_id")),
                    reader.GetGuid(reader.GetOrdinal("tender_id")),
                    reader.GetString(reader.GetOrdinal("tender_title")),
                    reader.IsDBNull(reader.GetOrdinal("department")) ? null : reader.GetString(reader.GetOrdinal("department")),
                    reader.IsDBNull(reader.GetOrdinal("amount")) ? null : reader.GetFieldValue<decimal>(reader.GetOrdinal("amount")),
                    reader.IsDBNull(reader.GetOrdinal("procurement_type")) ? null : reader.GetString(reader.GetOrdinal("procurement_type")),
                    reader.IsDBNull(reader.GetOrdinal("approval_route")) ? null : reader.GetString(reader.GetOrdinal("approval_route")),
                    reader.IsDBNull(reader.GetOrdinal("approval_authority_label")) ? null : reader.GetString(reader.GetOrdinal("approval_authority_label")),
                    reader.GetBoolean(reader.GetOrdinal("requires_bpp")),
                    reader.IsDBNull(reader.GetOrdinal("status")) ? null : reader.GetString(reader.GetOrdinal("status")),
                    reader.IsDBNull(reader.GetOrdinal("vendor_name")) ? null : reader.GetString(reader.GetOrdinal("vendor_name")),
                    reader.IsDBNull(reader.GetOrdinal("report_code")) ? null : reader.GetString(reader.GetOrdinal("report_code")),
                    reader.IsDBNull(reader.GetOrdinal("recommendation")) ? null : reader.GetString(reader.GetOrdinal("recommendation")),
                    reader.IsDBNull(reader.GetOrdinal("score_summary")) ? null : reader.GetString(reader.GetOrdinal("score_summary")),
                    reader.IsDBNull(reader.GetOrdinal("report_submitted_at")) ? null : reader.GetDateTime(reader.GetOrdinal("report_submitted_at")),
                    reader.GetDateTime(reader.GetOrdinal("created_at")),
                    reader.GetInt32(reader.GetOrdinal("days_pending"))));
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving tenders board queue.");
            return Problem("Internal server error retrieving tenders board queue.");
        }
    }

    [HttpPost("approve")]
    public async Task<IActionResult> Approve([FromBody] TendersBoardDecisionRequest request, CancellationToken ct)
    {
        return await HandleDecisionAsync(request, "approval.decide", DecisionType.Approve, ct);
    }

    [HttpPost("reject")]
    public async Task<IActionResult> Reject([FromBody] TendersBoardDecisionRequest request, CancellationToken ct)
    {
        return await HandleDecisionAsync(request, "approval.decide", DecisionType.Reject, ct);
    }

    [HttpPost("return")]
    public async Task<IActionResult> Return([FromBody] TendersBoardDecisionRequest request, CancellationToken ct)
    {
        return await HandleDecisionAsync(request, "approval.decide", DecisionType.Return, ct);
    }

    private async Task<IActionResult> HandleDecisionAsync(
        TendersBoardDecisionRequest request,
        string requiredAction,
        DecisionType decision,
        CancellationToken ct)
    {
        if (request is null)
        {
            return BadRequest(new { message = "Request body is required." });
        }

        if (request.TenderId == Guid.Empty)
        {
            return BadRequest(new { message = "TenderId is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Rationale))
        {
            return BadRequest(new { message = "Rationale is mandatory for Tenders Board decisions." });
        }

        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var hasAction = await _workflowActionGrantService.HasRequiredActionAsync(
                conn, tx, User, "tender", request.TenderId, requiredAction, ct);
            if (!hasAction)
            {
                return Forbid();
            }

            var current = await GetWorkflowInstanceAsync(conn, tx, request.TenderId, ct);
            if (current is null)
            {
                return NotFound(new { message = "Tender workflow record was not found." });
            }

            var routeDecision = await _workflowPolicyGuard.ResolveRouteDecisionAsync(conn, tx, "tender", request.TenderId, ct);
            if (routeDecision is null)
            {
                return BadRequest(new { message = "Workflow route could not be resolved for this tender." });
            }

            var target = ResolveDecisionTarget(decision, routeDecision.RequiresBpp);
            var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(conn, tx, "tender", request.TenderId, target.StageKey, ct);
            if (!transition.IsAllowed)
            {
                return BadRequest(new { message = transition.Message });
            }

            await _workflowRuntimeTracker.SyncAsync(
                conn,
                tx,
                new WorkflowRuntimeSyncRequest(
                    current.EntityType,
                    current.EntityId,
                    target.StageKey,
                    target.Status,
                    current.RecordTitle,
                    current.ParentEntityType,
                    current.ParentEntityId,
                    current.Amount,
                    current.ProcurementType,
                    current.ThresholdId,
                    $"{target.Reason} Rationale: {request.Rationale}",
                    request.Actor ?? User.Identity?.Name,
                    "tenders_board_approval"),
                ct);

            if (decision == DecisionType.Approve && !routeDecision.RequiresBpp)
            {
                await EnsureContractAwardAsync(conn, tx, current, request.Rationale, ct);
            }

            await tx.CommitAsync(ct);
            return Ok(new { message = target.Reason, targetStage = target.StageKey, requiresBpp = routeDecision.RequiresBpp });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing tenders board decision {Decision} for tender {TenderId}.", decision, request.TenderId);
            return Problem("Internal server error processing Tenders Board decision.");
        }
    }

    private static DecisionTarget ResolveDecisionTarget(DecisionType decision, bool requiresBpp)
    {
        return decision switch
        {
            DecisionType.Approve when requiresBpp => new("bpp_no_objection", "Approved", "Board endorsed tender for BPP no-objection."),
            DecisionType.Approve => new("award_and_publication", "Approved", "Board approved tender for award publication."),
            DecisionType.Reject => new("evaluation", "Rejected", "Board rejected the recommendation and returned it to evaluation."),
            DecisionType.Return => new("evaluation", "Under Review", "Board returned the recommendation for clarification."),
            _ => new("evaluation", "Under Review", "Board decision recorded.")
        };
    }

    private async Task EnsureContractAwardAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        WorkflowInstanceState current,
        string rationale,
        CancellationToken ct)
    {
        const string sql = @"
INSERT INTO post_award.contract_awards (
    award_code,
    tender_title,
    vendor_name,
    award_value,
    status,
    award_date,
    contract_start,
    contract_end,
    funding_source,
    notes
)
VALUES (
    @p_award_code,
    @p_tender_title,
    @p_vendor_name,
    @p_award_value,
    'Approved',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '14 days',
    CURRENT_TIMESTAMP + INTERVAL '365 days',
    'Capital Budget',
    @p_notes
)
ON CONFLICT (award_code) DO NOTHING;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_award_code", NpgsqlDbType.Varchar, $"AWARD-{current.EntityId.ToString().Substring(0, 8).ToUpper()}");
        cmd.Parameters.AddWithValue("p_tender_title", NpgsqlDbType.Varchar, current.RecordTitle ?? "Untitled Tender");
        cmd.Parameters.AddWithValue("p_vendor_name", NpgsqlDbType.Varchar, current.VendorName ?? "TBD");
        cmd.Parameters.AddWithValue("p_award_value", NpgsqlDbType.Numeric, current.Amount ?? 0);
        cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, $"Tenders Board approved. Rationale: {rationale}");
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task<WorkflowInstanceState?> GetWorkflowInstanceAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid tenderId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT
    wi.entity_type,
    wi.entity_id,
    wi.current_status,
    wi.record_title,
    wi.parent_entity_type,
    wi.parent_entity_id,
    wi.amount,
    wi.procurement_type,
    wi.threshold_id,
    vendor.company_name AS vendor_name
FROM procurement_workflow.workflow_instances wi
LEFT JOIN vendor_sourcing.bids bid
    ON bid.tender_id = wi.entity_id
   AND bid.status = 'Recommended'
LEFT JOIN identity.vendors vendor
    ON vendor.vendor_id = bid.vendor_id
WHERE wi.entity_type = 'tender'
  AND wi.entity_id = @p_tender_id
FOR UPDATE OF wi;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new WorkflowInstanceState(
            reader.GetString(reader.GetOrdinal("entity_type")),
            reader.GetGuid(reader.GetOrdinal("entity_id")),
            reader.IsDBNull(reader.GetOrdinal("current_status")) ? null : reader.GetString(reader.GetOrdinal("current_status")),
            reader.IsDBNull(reader.GetOrdinal("record_title")) ? null : reader.GetString(reader.GetOrdinal("record_title")),
            reader.IsDBNull(reader.GetOrdinal("parent_entity_type")) ? null : reader.GetString(reader.GetOrdinal("parent_entity_type")),
            reader.IsDBNull(reader.GetOrdinal("parent_entity_id")) ? null : reader.GetGuid(reader.GetOrdinal("parent_entity_id")),
            reader.IsDBNull(reader.GetOrdinal("amount")) ? null : reader.GetFieldValue<decimal>(reader.GetOrdinal("amount")),
            reader.IsDBNull(reader.GetOrdinal("procurement_type")) ? null : reader.GetString(reader.GetOrdinal("procurement_type")),
            reader.IsDBNull(reader.GetOrdinal("threshold_id")) ? null : reader.GetGuid(reader.GetOrdinal("threshold_id")),
            reader.IsDBNull(reader.GetOrdinal("vendor_name")) ? null : reader.GetString(reader.GetOrdinal("vendor_name")));
    }

    private enum DecisionType
    {
        Approve,
        Reject,
        Return
    }

    private sealed record DecisionTarget(string StageKey, string Status, string Reason);

    private sealed record WorkflowInstanceState(
        string EntityType,
        Guid EntityId,
        string? CurrentStatus,
        string? RecordTitle,
        string? ParentEntityType,
        Guid? ParentEntityId,
        decimal? Amount,
        string? ProcurementType,
        Guid? ThresholdId,
        string? VendorName);
}

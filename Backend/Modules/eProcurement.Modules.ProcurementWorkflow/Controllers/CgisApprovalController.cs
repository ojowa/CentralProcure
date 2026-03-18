using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Authorize]
[Route("api/cgis-approval")]
public class CgisApprovalController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<CgisApprovalController> _logger;
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private readonly WorkflowActionGrantService _workflowActionGrantService;

    public CgisApprovalController(
        IConfiguration config,
        ILogger<CgisApprovalController> logger,
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

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    [HttpPost("approve")]
    public async Task<IActionResult> Approve([FromBody] CgisApprovalRequest request, CancellationToken ct)
    {
        return await HandleActionAsync(request, "cgis.approve", "award_and_publication", "Award approved by CGIS.", ct);
    }

    [HttpPost("reject")]
    public async Task<IActionResult> Reject([FromBody] CgisApprovalRequest request, CancellationToken ct)
    {
        // Rejection path might depend on policy, but usually it moves to a rejected status or earlier stage.
        // For now, let's assume it moves back to evaluation or a terminal 'rejected' stage.
        // The spec says "follow the configured rejection path". 
        // We'll use a generic 'rejected' status for now if we don't have a specific stage.
        return await HandleActionAsync(request, "cgis.reject", "evaluation", "Award rejected by CGIS.", ct);
    }

    [HttpPost("return")]
    public async Task<IActionResult> Return([FromBody] CgisApprovalRequest request, CancellationToken ct)
    {
        return await HandleActionAsync(request, "cgis.return", "evaluation", "Returned for clarification by CGIS.", ct);
    }

    [HttpPost("escalate")]
    public async Task<IActionResult> Escalate([FromBody] CgisApprovalRequest request, CancellationToken ct)
    {
        // Escalation usually moves to BPP or Tenders Board if it wasn't there.
        return await HandleActionAsync(request, "cgis.escalate", "tenders_board_review", "Escalated by CGIS.", ct);
    }

    [HttpGet("documents/{entityType}/{entityId:guid}")]
    public async Task<IActionResult> GetCgisDocuments(string entityType, Guid entityId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string not configured.");
        }

        var docs = await _workflowRuntimeTracker.GetCgisDocumentsAsync(connectionString, entityType, entityId, ct);
        return Ok(docs.Select(d => new CgisDocumentDto(
            d.DocumentType,
            d.FileName,
            d.FileUrl,
            d.Status,
            d.UpdatedAt)));
    }

    private async Task<IActionResult> HandleActionAsync(
        CgisApprovalRequest request,
        string requiredAction,
        string targetStage,
        string defaultReason,
        CancellationToken ct)
    {
        if (request is null) return BadRequest(new { message = "Request body is required." });
        if (string.IsNullOrWhiteSpace(request.Rationale)) return BadRequest(new { message = "Rationale is mandatory for CGIS decisions." });

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString)) return Problem("Connection string not configured.");

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var hasAction = await _workflowActionGrantService.HasRequiredActionAsync(
                conn, tx, User, request.EntityType, request.EntityId, requiredAction, ct);

            if (!hasAction) return Forbid();

            var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(
                conn, tx, request.EntityType, request.EntityId, targetStage, ct);

            if (!transition.IsAllowed) return BadRequest(new { message = transition.Message });

            var current = await GetWorkflowInstanceAsync(conn, tx, request.EntityType, request.EntityId, ct);
            if (current is null) return NotFound(new { message = "Workflow instance not found." });

            await _workflowRuntimeTracker.SyncAsync(
                conn,
                tx,
                new WorkflowRuntimeSyncRequest(
                    current.EntityType,
                    current.EntityId,
                    targetStage,
                    targetStage == "award_and_publication" ? "Approved" : current.CurrentStatus,
                    current.RecordTitle,
                    current.ParentEntityType,
                    current.ParentEntityId,
                    current.Amount,
                    current.ProcurementType,
                    current.ThresholdId,
                    $"{defaultReason} Rationale: {request.Rationale}",
                    request.Actor ?? User.Identity?.Name,
                    "cgis_approval"),
                ct);

            if (targetStage == "award_and_publication" && current.EntityType == "tender")
            {
                await EnsureContractAwardAsync(conn, tx, current, request.Rationale, ct);
            }

            await tx.CommitAsync(ct);
            return Ok(new { message = "Action processed successfully.", targetStage });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing CGIS action {Action} for {EntityType} {EntityId}.", requiredAction, request.EntityType, request.EntityId);
            return Problem("Internal server error processing action.");
        }
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
        cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, $"CGIS Approved. Rationale: {rationale}");

        await cmd.ExecuteNonQueryAsync(ct);
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
    wi.entity_type,
    wi.entity_id,
    wi.current_stage_key,
    wi.current_status,
    wi.record_title,
    wi.parent_entity_type,
    wi.parent_entity_id,
    wi.amount,
    wi.procurement_type,
    wi.threshold_id,
    v.company_name as vendor_name
FROM procurement_workflow.workflow_instances wi
LEFT JOIN vendor_sourcing.bids b ON wi.entity_type = 'tender' AND b.tender_id = wi.entity_id AND b.status = 'Recommended'
LEFT JOIN identity.vendors v ON b.vendor_id = v.vendor_id
WHERE wi.entity_type = @p_entity_type
  AND wi.entity_id = @p_entity_id
FOR UPDATE;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, entityType.Trim().ToLowerInvariant());
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

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
            reader.IsDBNull(reader.GetOrdinal("threshold_id")) ? null : reader.GetGuid(reader.GetOrdinal("threshold_id")),
            reader.IsDBNull(reader.GetOrdinal("vendor_name")) ? null : reader.GetString(reader.GetOrdinal("vendor_name")));
    }

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
        Guid? ThresholdId,
        string? VendorName);
}

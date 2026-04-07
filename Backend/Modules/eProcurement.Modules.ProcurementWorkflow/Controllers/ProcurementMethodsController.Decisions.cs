using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class ProcurementMethodsController
{
    private static readonly HashSet<string> EarlyChangeStages = new(StringComparer.OrdinalIgnoreCase)
    {
        "threshold_resolution",
        "method_validation"
    };

    private static readonly HashSet<string> MaterialProgressStages = new(StringComparer.OrdinalIgnoreCase)
    {
        "solicitation",
        "bid_opening",
        "evaluation",
        "accounting_officer_review",
        "tenders_board_review",
        "bpp_no_objection",
        "award_and_publication"
    };

    [HttpPost("determine")]
    public async Task<IActionResult> Determine([FromBody] ProcurementMethodDecisionRequest request, CancellationToken ct)
    {
        if (!CanManageMethods())
        {
            return Forbid();
        }

        if (!TryNormalizeMethod(request.SelectedMethod, out var selectedMethod))
        {
            return BadRequest(new { message = "SelectedMethod must be CompetitiveTender or SimplifiedQuotation." });
        }

        if (string.IsNullOrWhiteSpace(request.Rationale))
        {
            return BadRequest(new { message = "Rationale is required." });
        }

        await using var conn = await OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var runtime = await GetRuntimeAsync(conn, tx, request.EntityType, request.EntityId, ct);
        var routeDecision = await _workflowPolicyGuard.ResolveRouteDecisionAsync(conn, tx, request.EntityType, request.EntityId, ct);
        if (runtime is null || routeDecision is null)
        {
            await tx.RollbackAsync(ct);
            return NotFound(new { message = "Workflow case not found." });
        }

        if (!routeDecision.RequiresCgisApproval)
        {
            await tx.RollbackAsync(ct);
            return BadRequest(new { message = "Method determination is available only for low-value CGIS-routed cases." });
        }

        if (!EarlyChangeStages.Contains(runtime.CurrentStageKey) &&
            await GetCurrentDecisionAsync(conn, tx, request.EntityType, request.EntityId, ct) is not null)
        {
            await tx.RollbackAsync(ct);
            return BadRequest(new { message = "Method re-determination at this stage requires the exception request path." });
        }

        if (await GetActiveExceptionAsync(conn, tx, request.EntityType, request.EntityId, ct) is not null)
        {
            await tx.RollbackAsync(ct);
            return BadRequest(new { message = "An active method-change exception already exists for this case." });
        }

        var decisionId = await InsertDecisionAsync(
            conn,
            tx,
            request.EntityType,
            request.EntityId,
            routeDecision.ThresholdId,
            routeDecision.ApprovalRoute,
            selectedMethod,
            request.Rationale.Trim(),
            ResolveActor(),
            false,
            ct);

        await tx.CommitAsync(ct);
        return Ok(new { message = "Procurement method recorded.", decisionId, selectedMethod });
    }

    [HttpPost("request-exception")]
    public async Task<IActionResult> RequestException([FromBody] ProcurementMethodChangeExceptionRequest request, CancellationToken ct)
    {
        if (!CanManageMethods())
        {
            return Forbid();
        }

        if (!TryNormalizeMethod(request.RequestedMethod, out var requestedMethod))
        {
            return BadRequest(new { message = "RequestedMethod must be CompetitiveTender or SimplifiedQuotation." });
        }

        if (string.IsNullOrWhiteSpace(request.Rationale))
        {
            return BadRequest(new { message = "Rationale is required." });
        }

        await using var conn = await OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var runtime = await GetRuntimeAsync(conn, tx, request.EntityType, request.EntityId, ct);
        var currentDecision = await GetCurrentDecisionAsync(conn, tx, request.EntityType, request.EntityId, ct);
        if (runtime is null || currentDecision is null)
        {
            await tx.RollbackAsync(ct);
            return BadRequest(new { message = "A current workflow case and method decision are required before requesting an exception." });
        }

        if (!MaterialProgressStages.Contains(runtime.CurrentStageKey))
        {
            await tx.RollbackAsync(ct);
            return BadRequest(new { message = "Use direct method determination before material vendor-facing progress begins." });
        }

        if (string.Equals(currentDecision.SelectedMethod, requestedMethod, StringComparison.OrdinalIgnoreCase))
        {
            await tx.RollbackAsync(ct);
            return BadRequest(new { message = "Requested method must differ from the current method." });
        }

        if (await GetActiveExceptionAsync(conn, tx, request.EntityType, request.EntityId, ct) is not null)
        {
            await tx.RollbackAsync(ct);
            return BadRequest(new { message = "An active exception already exists for this case." });
        }

        const string sql = @"
INSERT INTO procurement_workflow.procurement_method_change_exceptions (
    entity_type,
    entity_id,
    current_method,
    requested_method,
    request_reason,
    requested_by,
    prior_decision_id
)
VALUES (
    @p_entity_type,
    @p_entity_id,
    @p_current_method,
    @p_requested_method,
    @p_request_reason,
    @p_requested_by,
    @p_prior_decision_id
)
RETURNING exception_id;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, NormalizeEntityType(request.EntityType));
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, request.EntityId);
        cmd.Parameters.AddWithValue("p_current_method", NpgsqlDbType.Varchar, currentDecision.SelectedMethod);
        cmd.Parameters.AddWithValue("p_requested_method", NpgsqlDbType.Varchar, requestedMethod);
        cmd.Parameters.AddWithValue("p_request_reason", NpgsqlDbType.Text, request.Rationale.Trim());
        cmd.Parameters.AddWithValue("p_requested_by", NpgsqlDbType.Varchar, (object?)ResolveActor() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_prior_decision_id", NpgsqlDbType.Uuid, currentDecision.DecisionId);

        var exceptionId = (Guid)(await cmd.ExecuteScalarAsync(ct) ?? Guid.Empty);
        await tx.CommitAsync(ct);
        return Ok(new { message = "Late method-change exception submitted to CGIS.", exceptionId });
    }

    [HttpPost("exceptions/approve")]
    public async Task<IActionResult> ApproveException([FromBody] ProcurementMethodExceptionDecisionRequest request, CancellationToken ct)
        => await DecideExceptionAsync(request, "Approved", ct);

    [HttpPost("exceptions/reject")]
    public async Task<IActionResult> RejectException([FromBody] ProcurementMethodExceptionDecisionRequest request, CancellationToken ct)
        => await DecideExceptionAsync(request, "Rejected", ct);

    [HttpPost("exceptions/return")]
    public async Task<IActionResult> ReturnException([FromBody] ProcurementMethodExceptionDecisionRequest request, CancellationToken ct)
        => await DecideExceptionAsync(request, "ReturnedForClarification", ct);

    private async Task<IActionResult> DecideExceptionAsync(ProcurementMethodExceptionDecisionRequest request, string targetStatus, CancellationToken ct)
    {
        if (!CanReviewExceptions())
        {
            return Forbid();
        }

        await using var conn = await OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var exception = await GetExceptionByIdAsync(conn, tx, request.ExceptionId, ct);
        if (exception is null)
        {
            await tx.RollbackAsync(ct);
            return NotFound(new { message = "Exception request not found." });
        }

        if (exception.Status is "Approved" or "Rejected")
        {
            await tx.RollbackAsync(ct);
            return BadRequest(new { message = "This exception request has already been decided." });
        }

        Guid? resultingDecisionId = null;
        if (string.Equals(targetStatus, "Approved", StringComparison.OrdinalIgnoreCase))
        {
            resultingDecisionId = await ApproveExceptionDecisionAsync(conn, tx, exception, request.Note, ct);
        }

        await UpdateExceptionDecisionAsync(conn, tx, request.ExceptionId, targetStatus, request.Note, resultingDecisionId, ct);
        await tx.CommitAsync(ct);

        return Ok(new { message = $"Exception {targetStatus}.", status = targetStatus, resultingDecisionId });
    }

    private async Task<Guid?> ApproveExceptionDecisionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        MethodExceptionRow exception,
        string? note,
        CancellationToken ct)
    {
        var runtime = await GetRuntimeAsync(conn, tx, exception.EntityType, exception.EntityId, ct);
        var routeDecision = await _workflowPolicyGuard.ResolveRouteDecisionAsync(conn, tx, exception.EntityType, exception.EntityId, ct);
        if (runtime is null || routeDecision is null)
        {
            return null;
        }

        var decisionId = await InsertDecisionAsync(
            conn,
            tx,
            exception.EntityType,
            exception.EntityId,
            routeDecision.ThresholdId,
            routeDecision.ApprovalRoute,
            exception.RequestedMethod,
            note?.Trim() ?? exception.RequestReason,
            ResolveActor(),
            true,
            ct);

        await _workflowRuntimeTracker.SyncAsync(
            conn,
            tx,
            new WorkflowRuntimeSyncRequest(
                runtime.EntityType,
                runtime.EntityId,
                "method_validation",
                "Returned",
                runtime.RecordTitle,
                runtime.ParentEntityType,
                runtime.ParentEntityId,
                runtime.Amount,
                runtime.ProcurementType,
                runtime.ThresholdId,
                $"CGIS approved late method-change exception. Resume under {exception.RequestedMethod}. {note}".Trim(),
                ResolveActor(),
                "cgis_method_exception"),
            ct);

        return decisionId;
    }

    private async Task UpdateExceptionDecisionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid exceptionId,
        string targetStatus,
        string? note,
        Guid? resultingDecisionId,
        CancellationToken ct)
    {
        const string sql = @"
UPDATE procurement_workflow.procurement_method_change_exceptions
SET status = @p_status,
    cgis_note = @p_cgis_note,
    reviewed_by = @p_reviewed_by,
    reviewed_at = CURRENT_TIMESTAMP,
    resulting_decision_id = COALESCE(@p_resulting_decision_id, resulting_decision_id),
    updated_at = CURRENT_TIMESTAMP
WHERE exception_id = @p_exception_id;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, targetStatus);
        cmd.Parameters.AddWithValue("p_cgis_note", NpgsqlDbType.Text, (object?)note?.Trim() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_reviewed_by", NpgsqlDbType.Varchar, (object?)ResolveActor() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_resulting_decision_id", NpgsqlDbType.Uuid, (object?)resultingDecisionId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_exception_id", NpgsqlDbType.Uuid, exceptionId);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}

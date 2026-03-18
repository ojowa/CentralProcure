using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class AdministrativeReviewsController
{
    [HttpPost]
    public async Task<IActionResult> CreateAdministrativeReview([FromBody] AdministrativeReviewCreateRequest request, CancellationToken ct)
    {
        var validationError = ValidateCreateRequest(request);
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

            var normalizedEntityType = request.EntityType.Trim().ToLowerInvariant();
            var parent = await GetWorkflowInstanceAsync(conn, tx, normalizedEntityType, request.EntityId, ct);
            if (parent is null)
            {
                return NotFound("The referenced workflow record was not found.");
            }

            var hasAction = await _workflowActionGrantService.HasRequiredActionAsync(
                conn,
                tx,
                User,
                normalizedEntityType,
                request.EntityId,
                "administrative_review.create",
                ct);

            if (!hasAction)
            {
                return Forbid();
            }

            if (!FilingStageKeys.Contains(parent.CurrentStageKey))
            {
                return BadRequest("Complaints may only be filed from solicitation, evaluation, or award stages.");
            }

            var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(
                conn,
                tx,
                normalizedEntityType,
                request.EntityId,
                "administrative_review",
                ct);

            if (!transition.IsAllowed)
            {
                return BadRequest(transition.Message);
            }

            var detail = await InsertComplaintAsync(conn, tx, request, parent.CurrentStageKey, ct);

            await _workflowRuntimeTracker.SyncAsync(
                conn,
                tx,
                new WorkflowRuntimeSyncRequest(
                    "administrative_review",
                    detail.ComplaintId,
                    "administrative_review",
                    detail.Status,
                    detail.Subject,
                    detail.EntityType,
                    detail.EntityId,
                    parent.Amount,
                    parent.ProcurementType,
                    parent.ThresholdId,
                    $"Complaint filed against {detail.EntityType} record.",
                    detail.FiledBy,
                    "administrative_review"),
                ct);

            await _workflowRuntimeTracker.SyncAsync(
                conn,
                tx,
                new WorkflowRuntimeSyncRequest(
                    parent.EntityType,
                    parent.EntityId,
                    "administrative_review",
                    parent.CurrentStatus,
                    parent.RecordTitle,
                    parent.ParentEntityType,
                    parent.ParentEntityId,
                    parent.Amount,
                    parent.ProcurementType,
                    parent.ThresholdId,
                    $"Complaint {detail.ComplaintReference} filed: {detail.Subject}.",
                    detail.FiledBy,
                    "administrative_review"),
                ct);

            await tx.CommitAsync(ct);
            return Created($"/api/administrative-reviews/{detail.ComplaintId}", detail);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error creating administrative review.");
            return Problem("Internal server error creating administrative review.");
        }
    }

    [HttpPut("{complaintId:guid}")]
    public async Task<IActionResult> UpdateAdministrativeReview(Guid complaintId, [FromBody] AdministrativeReviewUpdateRequest request, CancellationToken ct)
    {
        var validationError = ValidateUpdateRequest(request, out var normalizedStatus, out var normalizedOutcome);
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

            var existing = await GetComplaintAsync(conn, tx, complaintId, ct);
            if (existing is null)
            {
                return NotFound();
            }

            var requiredAction = request.ResolutionOutcome is not null || normalizedStatus is "Resolved" or "Rejected" or "Closed"
                ? "administrative_review.resolve"
                : "administrative_review.update";

            var hasAction = await _workflowActionGrantService.HasRequiredActionAsync(
                conn,
                tx,
                User,
                "administrative_review",
                complaintId,
                requiredAction,
                ct);

            if (!hasAction)
            {
                return Forbid();
            }

            var resolvedStageKey = ResolveResolutionStageKey(existing, normalizedOutcome, request.ResolutionStageKey);
            if (resolvedStageKey is ErrorStageKey errorStageKey)
            {
                return BadRequest(errorStageKey.Message);
            }

            WorkflowInstanceState? parent = null;
            if (resolvedStageKey is string targetStageKey)
            {
                parent = await GetWorkflowInstanceAsync(conn, tx, existing.EntityType, existing.EntityId, ct);
                if (parent is null)
                {
                    return NotFound("The parent workflow record for this complaint was not found.");
                }

                var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(
                    conn,
                    tx,
                    existing.EntityType,
                    existing.EntityId,
                    targetStageKey,
                    ct);

                if (!transition.IsAllowed)
                {
                    return BadRequest(transition.Message);
                }
            }

            var detail = await UpdateComplaintAsync(conn, tx, complaintId, request, normalizedStatus, normalizedOutcome, resolvedStageKey as string, ct);

            await _workflowRuntimeTracker.SyncAsync(
                conn,
                tx,
                new WorkflowRuntimeSyncRequest(
                    "administrative_review",
                    detail.ComplaintId,
                    "administrative_review",
                    detail.Status,
                    detail.Subject,
                    detail.EntityType,
                    detail.EntityId,
                    parent?.Amount,
                    parent?.ProcurementType,
                    parent?.ThresholdId,
                    $"Complaint {detail.ComplaintReference} updated.",
                    detail.ReviewedBy ?? detail.AssignedTo ?? detail.FiledBy,
                    "administrative_review"),
                ct);

            if (resolvedStageKey is string exitStageKey && parent is not null)
            {
                await _workflowRuntimeTracker.SyncAsync(
                    conn,
                    tx,
                    new WorkflowRuntimeSyncRequest(
                        parent.EntityType,
                        parent.EntityId,
                        exitStageKey,
                        parent.CurrentStatus,
                        parent.RecordTitle,
                        parent.ParentEntityType,
                        parent.ParentEntityId,
                        parent.Amount,
                        parent.ProcurementType,
                        parent.ThresholdId,
                        $"Complaint {detail.ComplaintReference} resolved with outcome '{detail.ResolutionOutcome}'.",
                        detail.ReviewedBy ?? detail.AssignedTo,
                        "administrative_review_resolution"),
                    ct);
            }

            await tx.CommitAsync(ct);
            return Ok(detail);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error updating administrative review {ComplaintId}.", complaintId);
            return Problem("Internal server error updating administrative review.");
        }
    }
}

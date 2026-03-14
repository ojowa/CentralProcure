using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Controllers;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/administrative-reviews")]
public class AdministrativeReviewsController : BaseModuleController
{
    private static readonly string[] AllowedStatuses = { "Filed", "In Review", "Escalated", "Resolved", "Rejected", "Closed" };
    private static readonly string[] AllowedResolutionOutcomes =
    {
        "Resume Procurement",
        "Modify Decision",
        "Escalate To BPP",
        "Terminate Procurement",
        "Dismiss Complaint"
    };

    private static readonly HashSet<string> FilingStageKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "solicitation",
        "evaluation",
        "award_and_publication"
    };

    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private readonly WorkflowActionGrantService _workflowActionGrantService;

    public AdministrativeReviewsController(
        IConfiguration config,
        ILogger<AdministrativeReviewsController> logger,
        WorkflowPolicyGuard workflowPolicyGuard,
        WorkflowRuntimeTracker workflowRuntimeTracker,
        WorkflowActionGrantService workflowActionGrantService)
        : base(config, logger)
    {
        _workflowPolicyGuard = workflowPolicyGuard;
        _workflowRuntimeTracker = workflowRuntimeTracker;
        _workflowActionGrantService = workflowActionGrantService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAdministrativeReviews(
        [FromQuery] string? entityType,
        [FromQuery] Guid? entityId,
        [FromQuery] string? status,
        CancellationToken ct)
    {
        if (!TryNormalizeStatus(status, out var normalizedStatus))
        {
            return BadRequest($"Status must be one of: {string.Join(", ", AllowedStatuses)}.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
SELECT
    complaint_id,
    complaint_reference,
    entity_type,
    entity_id,
    stage_key_at_filing,
    status,
    subject,
    summary,
    details,
    complaint_channel,
    requested_remedy,
    filed_by,
    assigned_to,
    reviewed_by,
    resolution_outcome,
    resolution_stage_key,
    resolution_notes,
    filed_at,
    reviewed_at,
    resolved_at,
    created_at,
    updated_at
FROM procurement_workflow.procurement_complaints
WHERE (@p_entity_type IS NULL OR entity_type = @p_entity_type)
  AND (@p_entity_id IS NULL OR entity_id = @p_entity_id)
  AND (@p_status IS NULL OR status = @p_status)
ORDER BY filed_at DESC;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, (object?)NormalizeNullable(entityType)?.ToLowerInvariant() ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, (object?)entityId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);

            var results = new List<AdministrativeReviewSummary>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                results.Add(MapSummary(reader));
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error retrieving administrative reviews.");
            return Problem("Internal server error retrieving administrative reviews.");
        }
    }

    [HttpGet("{complaintId:guid}")]
    public async Task<IActionResult> GetAdministrativeReview(Guid complaintId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
SELECT
    complaint_id,
    complaint_reference,
    entity_type,
    entity_id,
    stage_key_at_filing,
    status,
    subject,
    summary,
    details,
    complaint_channel,
    requested_remedy,
    filed_by,
    assigned_to,
    reviewed_by,
    resolution_outcome,
    resolution_stage_key,
    resolution_notes,
    filed_at,
    reviewed_at,
    resolved_at,
    created_at,
    updated_at
FROM procurement_workflow.procurement_complaints
WHERE complaint_id = @p_complaint_id;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_complaint_id", NpgsqlDbType.Uuid, complaintId);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return NotFound();
            }

            return Ok(MapDetail(reader));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error retrieving administrative review {ComplaintId}.", complaintId);
            return Problem("Internal server error retrieving administrative review.");
        }
    }

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

    private static AdministrativeReviewSummary MapSummary(NpgsqlDataReader reader)
    {
        return new AdministrativeReviewSummary(
            reader.GetGuid(reader.GetOrdinal("complaint_id")),
            reader.GetString(reader.GetOrdinal("complaint_reference")),
            reader.GetString(reader.GetOrdinal("entity_type")),
            reader.GetGuid(reader.GetOrdinal("entity_id")),
            reader.GetString(reader.GetOrdinal("stage_key_at_filing")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.GetString(reader.GetOrdinal("subject")),
            GetNullableString(reader, "filed_by"),
            GetNullableString(reader, "assigned_to"),
            reader.GetDateTime(reader.GetOrdinal("filed_at")),
            GetNullableString(reader, "resolution_outcome"),
            GetNullableDateTime(reader, "resolved_at"));
    }

    private static AdministrativeReviewDetail MapDetail(NpgsqlDataReader reader)
    {
        return new AdministrativeReviewDetail(
            reader.GetGuid(reader.GetOrdinal("complaint_id")),
            reader.GetString(reader.GetOrdinal("complaint_reference")),
            reader.GetString(reader.GetOrdinal("entity_type")),
            reader.GetGuid(reader.GetOrdinal("entity_id")),
            reader.GetString(reader.GetOrdinal("stage_key_at_filing")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.GetString(reader.GetOrdinal("subject")),
            reader.GetString(reader.GetOrdinal("summary")),
            reader.GetString(reader.GetOrdinal("details")),
            GetNullableString(reader, "complaint_channel"),
            GetNullableString(reader, "requested_remedy"),
            GetNullableString(reader, "filed_by"),
            GetNullableString(reader, "assigned_to"),
            GetNullableString(reader, "reviewed_by"),
            GetNullableString(reader, "resolution_outcome"),
            GetNullableString(reader, "resolution_stage_key"),
            GetNullableString(reader, "resolution_notes"),
            reader.GetDateTime(reader.GetOrdinal("filed_at")),
            GetNullableDateTime(reader, "reviewed_at"),
            GetNullableDateTime(reader, "resolved_at"),
            reader.GetDateTime(reader.GetOrdinal("created_at")),
            reader.GetDateTime(reader.GetOrdinal("updated_at")));
    }

    private static string? ValidateCreateRequest(AdministrativeReviewCreateRequest? request)
    {
        if (request is null)
        {
            return "Request body is required.";
        }

        if (string.IsNullOrWhiteSpace(request.EntityType))
        {
            return "EntityType is required.";
        }

        if (request.EntityId == Guid.Empty)
        {
            return "EntityId is required.";
        }

        if (string.IsNullOrWhiteSpace(request.Subject) || request.Subject.Trim().Length < 5)
        {
            return "Subject must be at least 5 characters.";
        }

        if (string.IsNullOrWhiteSpace(request.Summary) || request.Summary.Trim().Length < 10)
        {
            return "Summary must be at least 10 characters.";
        }

        if (string.IsNullOrWhiteSpace(request.Details) || request.Details.Trim().Length < 20)
        {
            return "Details must be at least 20 characters.";
        }

        return null;
    }

    private static string? ValidateUpdateRequest(
        AdministrativeReviewUpdateRequest? request,
        out string? normalizedStatus,
        out string? normalizedOutcome)
    {
        normalizedStatus = null;
        normalizedOutcome = null;

        if (request is null)
        {
            return "Request body is required.";
        }

        var hasAny =
            request.Status is not null ||
            request.AssignedTo is not null ||
            request.ReviewedBy is not null ||
            request.ResolutionOutcome is not null ||
            request.ResolutionStageKey is not null ||
            request.ResolutionNotes is not null;

        if (!hasAny)
        {
            return "At least one field is required to update a complaint.";
        }

        if (!TryNormalizeStatus(request.Status, out normalizedStatus))
        {
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
        }

        if (!TryNormalizeOutcome(request.ResolutionOutcome, out normalizedOutcome))
        {
            return $"ResolutionOutcome must be one of: {string.Join(", ", AllowedResolutionOutcomes)}.";
        }

        var isResolutionStatus =
            string.Equals(normalizedStatus, "Resolved", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(normalizedStatus, "Rejected", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(normalizedStatus, "Closed", StringComparison.OrdinalIgnoreCase);

        if (isResolutionStatus && string.IsNullOrWhiteSpace(normalizedOutcome))
        {
            return "ResolutionOutcome is required when resolving, rejecting, or closing a complaint.";
        }

        if (isResolutionStatus && string.IsNullOrWhiteSpace(request.ResolutionNotes))
        {
            return "ResolutionNotes are required when resolving, rejecting, or closing a complaint.";
        }

        return null;
    }

    private static bool TryNormalizeStatus(string? status, out string? normalizedStatus)
    {
        normalizedStatus = null;
        if (string.IsNullOrWhiteSpace(status))
        {
            return true;
        }

        normalizedStatus = AllowedStatuses.FirstOrDefault(item => item.Equals(status.Trim(), StringComparison.OrdinalIgnoreCase));
        return normalizedStatus is not null;
    }

    private static bool TryNormalizeOutcome(string? outcome, out string? normalizedOutcome)
    {
        normalizedOutcome = null;
        if (string.IsNullOrWhiteSpace(outcome))
        {
            return true;
        }

        normalizedOutcome = AllowedResolutionOutcomes.FirstOrDefault(item => item.Equals(outcome.Trim(), StringComparison.OrdinalIgnoreCase));
        return normalizedOutcome is not null;
    }

    private static object? ResolveResolutionStageKey(
        AdministrativeReviewDetail complaint,
        string? resolutionOutcome,
        string? requestedResolutionStageKey)
    {
        if (string.IsNullOrWhiteSpace(resolutionOutcome) && string.IsNullOrWhiteSpace(requestedResolutionStageKey))
        {
            return null;
        }

        var normalizedRequestedStageKey = NormalizeNullable(requestedResolutionStageKey)?.ToLowerInvariant();
        string? resolvedStageKey = resolutionOutcome switch
        {
            "Escalate To BPP" => "bpp_no_objection",
            "Terminate Procurement" => "closeout_and_audit",
            "Resume Procurement" => complaint.StageKeyAtFiling,
            "Dismiss Complaint" => complaint.StageKeyAtFiling,
            "Modify Decision" => normalizedRequestedStageKey ?? complaint.StageKeyAtFiling,
            _ => normalizedRequestedStageKey
        };

        if (string.IsNullOrWhiteSpace(resolvedStageKey))
        {
            return null;
        }

        if (string.Equals(resolutionOutcome, "Escalate To BPP", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(resolvedStageKey, "bpp_no_objection", StringComparison.OrdinalIgnoreCase))
        {
            return new ErrorStageKey("Escalate To BPP complaints must exit to 'bpp_no_objection'.");
        }

        if (string.Equals(resolutionOutcome, "Terminate Procurement", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(resolvedStageKey, "closeout_and_audit", StringComparison.OrdinalIgnoreCase))
        {
            return new ErrorStageKey("Terminate Procurement complaints must exit to 'closeout_and_audit'.");
        }

        return resolvedStageKey;
    }

    private async Task<AdministrativeReviewDetail> InsertComplaintAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        AdministrativeReviewCreateRequest request,
        string stageKeyAtFiling,
        CancellationToken ct)
    {
        const string sql = @"
INSERT INTO procurement_workflow.procurement_complaints (
    complaint_reference,
    entity_type,
    entity_id,
    stage_key_at_filing,
    status,
    subject,
    summary,
    details,
    complaint_channel,
    requested_remedy,
    filed_by,
    assigned_to
)
VALUES (
    CONCAT('ADR-', TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'), '-', UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 6))),
    @p_entity_type,
    @p_entity_id,
    @p_stage_key_at_filing,
    'Filed',
    @p_subject,
    @p_summary,
    @p_details,
    @p_complaint_channel,
    @p_requested_remedy,
    @p_filed_by,
    @p_assigned_to
)
RETURNING
    complaint_id,
    complaint_reference,
    entity_type,
    entity_id,
    stage_key_at_filing,
    status,
    subject,
    summary,
    details,
    complaint_channel,
    requested_remedy,
    filed_by,
    assigned_to,
    reviewed_by,
    resolution_outcome,
    resolution_stage_key,
    resolution_notes,
    filed_at,
    reviewed_at,
    resolved_at,
    created_at,
    updated_at;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, request.EntityType.Trim().ToLowerInvariant());
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, request.EntityId);
        cmd.Parameters.AddWithValue("p_stage_key_at_filing", NpgsqlDbType.Varchar, stageKeyAtFiling);
        cmd.Parameters.AddWithValue("p_subject", NpgsqlDbType.Varchar, request.Subject.Trim());
        cmd.Parameters.AddWithValue("p_summary", NpgsqlDbType.Text, request.Summary.Trim());
        cmd.Parameters.AddWithValue("p_details", NpgsqlDbType.Text, request.Details.Trim());
        cmd.Parameters.AddWithValue("p_complaint_channel", NpgsqlDbType.Varchar, (object?)NormalizeNullable(request.ComplaintChannel) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_requested_remedy", NpgsqlDbType.Text, (object?)NormalizeNullable(request.RequestedRemedy) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_filed_by", NpgsqlDbType.Varchar, (object?)NormalizeNullable(request.FiledBy) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_assigned_to", NpgsqlDbType.Varchar, (object?)NormalizeNullable(request.AssignedTo) ?? DBNull.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return MapDetail(reader);
    }

    private async Task<AdministrativeReviewDetail> UpdateComplaintAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid complaintId,
        AdministrativeReviewUpdateRequest request,
        string? normalizedStatus,
        string? normalizedOutcome,
        string? resolutionStageKey,
        CancellationToken ct)
    {
        const string sql = @"
UPDATE procurement_workflow.procurement_complaints
SET
    status = COALESCE(@p_status, status),
    assigned_to = COALESCE(@p_assigned_to, assigned_to),
    reviewed_by = COALESCE(@p_reviewed_by, reviewed_by),
    resolution_outcome = COALESCE(@p_resolution_outcome, resolution_outcome),
    resolution_stage_key = COALESCE(@p_resolution_stage_key, resolution_stage_key),
    resolution_notes = COALESCE(@p_resolution_notes, resolution_notes),
    reviewed_at = CASE
        WHEN @p_reviewed_by IS NOT NULL OR COALESCE(@p_status, status) IN ('In Review', 'Escalated', 'Resolved', 'Rejected', 'Closed')
            THEN COALESCE(reviewed_at, NOW())
        ELSE reviewed_at
    END,
    resolved_at = CASE
        WHEN COALESCE(@p_status, status) IN ('Resolved', 'Rejected', 'Closed')
            THEN COALESCE(resolved_at, NOW())
        ELSE resolved_at
    END,
    updated_at = NOW()
WHERE complaint_id = @p_complaint_id
RETURNING
    complaint_id,
    complaint_reference,
    entity_type,
    entity_id,
    stage_key_at_filing,
    status,
    subject,
    summary,
    details,
    complaint_channel,
    requested_remedy,
    filed_by,
    assigned_to,
    reviewed_by,
    resolution_outcome,
    resolution_stage_key,
    resolution_notes,
    filed_at,
    reviewed_at,
    resolved_at,
    created_at,
    updated_at;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_complaint_id", NpgsqlDbType.Uuid, complaintId);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_assigned_to", NpgsqlDbType.Varchar, (object?)NormalizeNullable(request.AssignedTo) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_reviewed_by", NpgsqlDbType.Varchar, (object?)NormalizeNullable(request.ReviewedBy) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_resolution_outcome", NpgsqlDbType.Varchar, (object?)normalizedOutcome ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_resolution_stage_key", NpgsqlDbType.Varchar, (object?)resolutionStageKey ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_resolution_notes", NpgsqlDbType.Text, (object?)NormalizeNullable(request.ResolutionNotes) ?? DBNull.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return MapDetail(reader);
    }

    private static async Task<AdministrativeReviewDetail?> GetComplaintAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid complaintId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT
    complaint_id,
    complaint_reference,
    entity_type,
    entity_id,
    stage_key_at_filing,
    status,
    subject,
    summary,
    details,
    complaint_channel,
    requested_remedy,
    filed_by,
    assigned_to,
    reviewed_by,
    resolution_outcome,
    resolution_stage_key,
    resolution_notes,
    filed_at,
    reviewed_at,
    resolved_at,
    created_at,
    updated_at
FROM procurement_workflow.procurement_complaints
WHERE complaint_id = @p_complaint_id
FOR UPDATE;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_complaint_id", NpgsqlDbType.Uuid, complaintId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return MapDetail(reader);
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
            GetNullableString(reader, "current_status"),
            GetNullableString(reader, "record_title"),
            GetNullableString(reader, "parent_entity_type"),
            GetNullableGuid(reader, "parent_entity_id"),
            GetNullableDecimal(reader, "amount"),
            GetNullableString(reader, "procurement_type"),
            GetNullableGuid(reader, "threshold_id"));
    }

    private static string? NormalizeNullable(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

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

    private sealed record ErrorStageKey(string Message);
}

using eProcurement.Modules.Governance.DTOs;
using eProcurement.Shared.Controllers;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Governance.Controllers;

[ApiController]
[Route("api/audit")]
public class AuditController : BaseModuleController
{
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private readonly WorkflowActionGrantService _workflowActionGrantService;

    public AuditController(
        IConfiguration config,
        ILogger<AuditController> logger,
        WorkflowPolicyGuard workflowPolicyGuard,
        WorkflowRuntimeTracker workflowRuntimeTracker,
        WorkflowActionGrantService workflowActionGrantService)
        : base(config, logger)
    {
        _workflowPolicyGuard = workflowPolicyGuard;
        _workflowRuntimeTracker = workflowRuntimeTracker;
        _workflowActionGrantService = workflowActionGrantService;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string countsSql = @"
SELECT
    (SELECT COUNT(*)
     FROM procurement_workflow.workflow_instances wi
     JOIN procurement_workflow.workflow_stage_catalog sc
       ON sc.stage_key = wi.current_stage_key
     WHERE sc.is_terminal = FALSE) AS active_workflow_items,
    (SELECT COUNT(*)
     FROM procurement_workflow.procurement_complaints
     WHERE status IN ('Filed', 'In Review', 'Escalated')) AS administrative_reviews_open,
    (SELECT COUNT(*)
     FROM procurement_workflow.procurement_closeouts
     WHERE status = 'Archived') AS closeouts_archived,
    (SELECT COUNT(*)
     FROM procurement_workflow.workflow_instance_history
     WHERE created_at >= NOW() - INTERVAL '30 days') AS recent_transitions;";

        const string eventsSql = @"
SELECT
    h.history_id,
    wi.entity_type,
    wi.entity_id,
    h.from_stage_key,
    h.to_stage_key,
    sc.stage_title,
    h.stage_status,
    h.transition_source,
    h.actor,
    h.created_at
FROM procurement_workflow.workflow_instance_history h
JOIN procurement_workflow.workflow_instances wi
  ON wi.instance_id = h.instance_id
JOIN procurement_workflow.workflow_stage_catalog sc
  ON sc.stage_key = h.to_stage_key
ORDER BY h.created_at DESC
LIMIT 10;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            int activeWorkflowItems;
            int administrativeReviewsOpen;
            int closeoutsArchived;
            int recentTransitions;

            await using (var countsCmd = new NpgsqlCommand(countsSql, conn))
            await using (var countsReader = await countsCmd.ExecuteReaderAsync(ct))
            {
                await countsReader.ReadAsync(ct);
                activeWorkflowItems = countsReader.GetInt32(countsReader.GetOrdinal("active_workflow_items"));
                administrativeReviewsOpen = countsReader.GetInt32(countsReader.GetOrdinal("administrative_reviews_open"));
                closeoutsArchived = countsReader.GetInt32(countsReader.GetOrdinal("closeouts_archived"));
                recentTransitions = countsReader.GetInt32(countsReader.GetOrdinal("recent_transitions"));
            }

            var events = new List<AuditEventItem>();
            await using (var eventsCmd = new NpgsqlCommand(eventsSql, conn))
            await using (var eventsReader = await eventsCmd.ExecuteReaderAsync(ct))
            {
                while (await eventsReader.ReadAsync(ct))
                {
                    events.Add(new AuditEventItem(
                        eventsReader.GetGuid(eventsReader.GetOrdinal("history_id")),
                        eventsReader.GetString(eventsReader.GetOrdinal("entity_type")),
                        eventsReader.GetGuid(eventsReader.GetOrdinal("entity_id")),
                        GetNullableString(eventsReader, "from_stage_key"),
                        eventsReader.GetString(eventsReader.GetOrdinal("to_stage_key")),
                        eventsReader.GetString(eventsReader.GetOrdinal("stage_title")),
                        GetNullableString(eventsReader, "stage_status"),
                        eventsReader.GetString(eventsReader.GetOrdinal("transition_source")),
                        GetNullableString(eventsReader, "actor"),
                        eventsReader.GetDateTime(eventsReader.GetOrdinal("created_at"))));
                }
            }

            return Ok(new AuditSummaryResponse(
                activeWorkflowItems,
                administrativeReviewsOpen,
                closeoutsArchived,
                recentTransitions,
                events));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error retrieving audit summary.");
            return Problem("Internal server error retrieving audit summary.");
        }
    }

    [HttpGet("closeouts")]
    public async Task<IActionResult> GetCloseouts([FromQuery] string? status, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(status) &&
            !new[] { "Submitted", "Archived", "Reopened" }.Any(item => item.Equals(status.Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            return BadRequest("Status must be one of: Submitted, Archived, Reopened.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
SELECT
    closeout_id,
    closeout_reference,
    entity_type,
    entity_id,
    status,
    record_title,
    final_acceptance_completed,
    final_payment_completed,
    archived_by,
    archived_at,
    created_at
FROM procurement_workflow.procurement_closeouts
WHERE (@p_status IS NULL OR status = @p_status)
ORDER BY archived_at DESC NULLS LAST, created_at DESC;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)NormalizeNullable(status) ?? DBNull.Value);

            var results = new List<AuditCloseoutItem>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                results.Add(MapCloseout(reader));
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error retrieving closeouts.");
            return Problem("Internal server error retrieving closeouts.");
        }
    }

    [HttpPost("closeouts")]
    public async Task<IActionResult> CreateCloseout([FromBody] AuditCloseoutCreateRequest request, CancellationToken ct)
    {
        var validationError = ValidateCreateCloseoutRequest(request);
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

            var entityType = request.EntityType.Trim().ToLowerInvariant();
            var workflowInstance = await GetWorkflowInstanceAsync(conn, tx, entityType, request.EntityId, ct);
            if (workflowInstance is null)
            {
                return NotFound("The referenced workflow record was not found.");
            }

            var hasAction = await _workflowActionGrantService.HasRequiredActionAsync(
                conn,
                tx,
                User,
                entityType,
                request.EntityId,
                "closeout.create",
                ct);

            if (!hasAction)
            {
                return Forbid();
            }

            var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(
                conn,
                tx,
                entityType,
                request.EntityId,
                "closeout_and_audit",
                ct);

            if (!transition.IsAllowed)
            {
                return BadRequest(transition.Message);
            }

            if (!request.FinalAcceptanceCompleted || !request.FinalPaymentCompleted)
            {
                return BadRequest("FinalAcceptanceCompleted and FinalPaymentCompleted must both be true before closeout.");
            }

            var closeout = await InsertCloseoutAsync(conn, tx, request, workflowInstance.RecordTitle, ct);

            await _workflowRuntimeTracker.SyncAsync(
                conn,
                tx,
                new WorkflowRuntimeSyncRequest(
                    workflowInstance.EntityType,
                    workflowInstance.EntityId,
                    "closeout_and_audit",
                    closeout.Status,
                    workflowInstance.RecordTitle,
                    workflowInstance.ParentEntityType,
                    workflowInstance.ParentEntityId,
                    workflowInstance.Amount,
                    workflowInstance.ProcurementType,
                    workflowInstance.ThresholdId,
                    $"Closeout {closeout.CloseoutReference} archived.",
                    closeout.ArchivedBy,
                    "closeout"),
                ct);

            await tx.CommitAsync(ct);
            return Created($"/api/audit/closeouts/{closeout.CloseoutId}", closeout);
        }
        catch (PostgresException ex) when (ex.SqlState == "23505")
        {
            Logger.LogWarning(ex, "Duplicate closeout attempted for {EntityType} {EntityId}.", request.EntityType, request.EntityId);
            return Conflict("A closeout record already exists for this workflow entity.");
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error creating closeout for {EntityType} {EntityId}.", request.EntityType, request.EntityId);
            return Problem("Internal server error creating closeout.");
        }
    }

    private static AuditCloseoutItem MapCloseout(NpgsqlDataReader reader)
    {
        return new AuditCloseoutItem(
            reader.GetGuid(reader.GetOrdinal("closeout_id")),
            reader.GetString(reader.GetOrdinal("closeout_reference")),
            reader.GetString(reader.GetOrdinal("entity_type")),
            reader.GetGuid(reader.GetOrdinal("entity_id")),
            reader.GetString(reader.GetOrdinal("status")),
            GetNullableString(reader, "record_title"),
            reader.GetBoolean(reader.GetOrdinal("final_acceptance_completed")),
            reader.GetBoolean(reader.GetOrdinal("final_payment_completed")),
            GetNullableString(reader, "archived_by"),
            GetNullableDateTime(reader, "archived_at"),
            reader.GetDateTime(reader.GetOrdinal("created_at")));
    }

    private static string? ValidateCreateCloseoutRequest(AuditCloseoutCreateRequest? request)
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

        if (string.IsNullOrWhiteSpace(request.Summary) || request.Summary.Trim().Length < 10)
        {
            return "Summary must be at least 10 characters.";
        }

        return null;
    }

    private async Task<AuditCloseoutItem> InsertCloseoutAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        AuditCloseoutCreateRequest request,
        string? recordTitle,
        CancellationToken ct)
    {
        const string sql = @"
INSERT INTO procurement_workflow.procurement_closeouts (
    closeout_reference,
    entity_type,
    entity_id,
    status,
    record_title,
    summary,
    archive_location,
    final_acceptance_completed,
    final_payment_completed,
    archived_by,
    archived_at
)
VALUES (
    CONCAT('CLS-', TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'), '-', UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 6))),
    @p_entity_type,
    @p_entity_id,
    'Archived',
    @p_record_title,
    @p_summary,
    @p_archive_location,
    @p_final_acceptance_completed,
    @p_final_payment_completed,
    @p_archived_by,
    NOW()
)
RETURNING
    closeout_id,
    closeout_reference,
    entity_type,
    entity_id,
    status,
    record_title,
    final_acceptance_completed,
    final_payment_completed,
    archived_by,
    archived_at,
    created_at;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, request.EntityType.Trim().ToLowerInvariant());
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, request.EntityId);
        cmd.Parameters.AddWithValue("p_record_title", NpgsqlDbType.Varchar, (object?)recordTitle ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_summary", NpgsqlDbType.Text, request.Summary.Trim());
        cmd.Parameters.AddWithValue("p_archive_location", NpgsqlDbType.Text, (object?)NormalizeNullable(request.ArchiveLocation) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_final_acceptance_completed", NpgsqlDbType.Boolean, request.FinalAcceptanceCompleted);
        cmd.Parameters.AddWithValue("p_final_payment_completed", NpgsqlDbType.Boolean, request.FinalPaymentCompleted);
        cmd.Parameters.AddWithValue("p_archived_by", NpgsqlDbType.Varchar, (object?)NormalizeNullable(request.ArchivedBy) ?? DBNull.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return MapCloseout(reader);
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
}

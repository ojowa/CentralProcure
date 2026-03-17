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
    summary,
    archive_location,
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

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory(
        [FromQuery] string? entityType,
        [FromQuery] Guid? entityId,
        [FromQuery] string? actor,
        [FromQuery] string? transitionSource,
        [FromQuery] string? query,
        [FromQuery] DateTime? dateFrom,
        [FromQuery] DateTime? dateTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
        CancellationToken ct = default)
    {
        if (page < 1)
        {
            return BadRequest("Page must be 1 or greater.");
        }

        if (pageSize <= 0 || pageSize > 100)
        {
            return BadRequest("PageSize must be between 1 and 100.");
        }

        var sortColumns = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["createdAt"] = "h.created_at",
            ["entityType"] = "LOWER(wi.entity_type)",
            ["recordTitle"] = "LOWER(COALESCE(wi.record_title, ''))",
            ["fromStageTitle"] = "LOWER(COALESCE(from_sc.stage_title, ''))",
            ["toStageTitle"] = "LOWER(to_sc.stage_title)",
            ["stageStatus"] = "LOWER(COALESCE(h.stage_status, ''))",
            ["transitionSource"] = "LOWER(h.transition_source)",
            ["actor"] = "LOWER(COALESCE(h.actor, ''))"
        };

        sortBy ??= "createdAt";
        if (!sortColumns.TryGetValue(sortBy, out var sortColumnSql))
        {
            return BadRequest("SortBy is not supported.");
        }

        var sortDirectionSql = sortDir?.Trim().ToLowerInvariant() switch
        {
            null or "" or "desc" => "DESC",
            "asc" => "ASC",
            _ => null
        };

        if (sortDirectionSql is null)
        {
            return BadRequest("SortDir must be 'asc' or 'desc'.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string countSql = @"
SELECT COUNT(*)
FROM procurement_workflow.workflow_instance_history h
JOIN procurement_workflow.workflow_instances wi
  ON wi.instance_id = h.instance_id
LEFT JOIN procurement_workflow.workflow_stage_catalog from_sc
  ON from_sc.stage_key = h.from_stage_key
JOIN procurement_workflow.workflow_stage_catalog to_sc
  ON to_sc.stage_key = h.to_stage_key
WHERE (@p_entity_type IS NULL OR wi.entity_type = @p_entity_type)
  AND (@p_entity_id IS NULL OR wi.entity_id = @p_entity_id)
  AND (@p_actor IS NULL OR h.actor ILIKE '%' || @p_actor || '%')
  AND (@p_transition_source IS NULL OR h.transition_source = @p_transition_source)
  AND (
      @p_query IS NULL
      OR wi.record_title ILIKE '%' || @p_query || '%'
      OR wi.entity_type ILIKE '%' || @p_query || '%'
      OR CAST(wi.entity_id AS TEXT) ILIKE '%' || @p_query || '%'
      OR COALESCE(h.transition_reason, '') ILIKE '%' || @p_query || '%'
      OR COALESCE(h.actor, '') ILIKE '%' || @p_query || '%'
      OR to_sc.stage_title ILIKE '%' || @p_query || '%'
      OR COALESCE(from_sc.stage_title, '') ILIKE '%' || @p_query || '%'
  )
  AND (@p_date_from IS NULL OR h.created_at >= @p_date_from)
  AND (@p_date_to IS NULL OR h.created_at <= @p_date_to);";

        var orderByClause = string.Equals(sortColumnSql, "h.created_at", StringComparison.Ordinal)
            ? $"ORDER BY {sortColumnSql} {sortDirectionSql}, h.history_id DESC"
            : $"ORDER BY {sortColumnSql} {sortDirectionSql}, h.created_at DESC, h.history_id DESC";

        var sql = $@"
SELECT
    h.history_id,
    wi.entity_type,
    wi.entity_id,
    wi.record_title,
    wi.current_stage_key,
    current_sc.stage_title AS current_stage_title,
    h.from_stage_key,
    from_sc.stage_title AS from_stage_title,
    h.to_stage_key,
    to_sc.stage_title AS to_stage_title,
    h.stage_status,
    h.transition_source,
    h.transition_reason,
    h.actor,
    h.created_at
FROM procurement_workflow.workflow_instance_history h
JOIN procurement_workflow.workflow_instances wi
  ON wi.instance_id = h.instance_id
LEFT JOIN procurement_workflow.workflow_stage_catalog current_sc
  ON current_sc.stage_key = wi.current_stage_key
LEFT JOIN procurement_workflow.workflow_stage_catalog from_sc
  ON from_sc.stage_key = h.from_stage_key
JOIN procurement_workflow.workflow_stage_catalog to_sc
  ON to_sc.stage_key = h.to_stage_key
WHERE (@p_entity_type IS NULL OR wi.entity_type = @p_entity_type)
  AND (@p_entity_id IS NULL OR wi.entity_id = @p_entity_id)
  AND (@p_actor IS NULL OR h.actor ILIKE '%' || @p_actor || '%')
  AND (@p_transition_source IS NULL OR h.transition_source = @p_transition_source)
  AND (
      @p_query IS NULL
      OR wi.record_title ILIKE '%' || @p_query || '%'
      OR wi.entity_type ILIKE '%' || @p_query || '%'
      OR CAST(wi.entity_id AS TEXT) ILIKE '%' || @p_query || '%'
      OR COALESCE(h.transition_reason, '') ILIKE '%' || @p_query || '%'
      OR COALESCE(h.actor, '') ILIKE '%' || @p_query || '%'
      OR to_sc.stage_title ILIKE '%' || @p_query || '%'
      OR COALESCE(from_sc.stage_title, '') ILIKE '%' || @p_query || '%'
  )
  AND (@p_date_from IS NULL OR h.created_at >= @p_date_from)
  AND (@p_date_to IS NULL OR h.created_at <= @p_date_to)
{orderByClause}
LIMIT @p_page_size
OFFSET @p_offset;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            static void AddHistoryFilterParameters(
                NpgsqlCommand command,
                string? nextEntityType,
                Guid? nextEntityId,
                string? nextActor,
                string? nextTransitionSource,
                string? nextQuery,
                DateTime? nextDateFrom,
                DateTime? nextDateTo)
            {
                command.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, (object?)NormalizeNullable(nextEntityType)?.ToLowerInvariant() ?? DBNull.Value);
                command.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, (object?)nextEntityId ?? DBNull.Value);
                command.Parameters.AddWithValue("p_actor", NpgsqlDbType.Varchar, (object?)NormalizeNullable(nextActor) ?? DBNull.Value);
                command.Parameters.AddWithValue("p_transition_source", NpgsqlDbType.Varchar, (object?)NormalizeNullable(nextTransitionSource) ?? DBNull.Value);
                command.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)NormalizeNullable(nextQuery) ?? DBNull.Value);
                command.Parameters.AddWithValue("p_date_from", NpgsqlDbType.Timestamp, (object?)nextDateFrom ?? DBNull.Value);
                command.Parameters.AddWithValue("p_date_to", NpgsqlDbType.Timestamp, (object?)nextDateTo ?? DBNull.Value);
            }

            await using var countCmd = new NpgsqlCommand(countSql, conn);
            AddHistoryFilterParameters(countCmd, entityType, entityId, actor, transitionSource, query, dateFrom, dateTo);
            var totalResult = await countCmd.ExecuteScalarAsync(ct);
            var total = totalResult is null ? 0 : Convert.ToInt32(totalResult);

            await using var cmd = new NpgsqlCommand(sql, conn);
            AddHistoryFilterParameters(cmd, entityType, entityId, actor, transitionSource, query, dateFrom, dateTo);
            cmd.Parameters.AddWithValue("p_page_size", NpgsqlDbType.Integer, pageSize);
            cmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, (page - 1) * pageSize);

            var results = new List<AuditHistoryItem>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                results.Add(new AuditHistoryItem(
                    reader.GetGuid(reader.GetOrdinal("history_id")),
                    reader.GetString(reader.GetOrdinal("entity_type")),
                    reader.GetGuid(reader.GetOrdinal("entity_id")),
                    GetNullableString(reader, "record_title"),
                    GetNullableString(reader, "current_stage_key"),
                    GetNullableString(reader, "current_stage_title"),
                    GetNullableString(reader, "from_stage_key"),
                    GetNullableString(reader, "from_stage_title"),
                    reader.GetString(reader.GetOrdinal("to_stage_key")),
                    reader.GetString(reader.GetOrdinal("to_stage_title")),
                    GetNullableString(reader, "stage_status"),
                    reader.GetString(reader.GetOrdinal("transition_source")),
                    GetNullableString(reader, "transition_reason"),
                    GetNullableString(reader, "actor"),
                    reader.GetDateTime(reader.GetOrdinal("created_at"))));
            }

            return Ok(new AuditHistoryListResponse(results, page, pageSize, total));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error retrieving audit history.");
            return Problem("Internal server error retrieving audit history.");
        }
    }

    [HttpGet("diagnostics/{entityType}/{entityId:guid}")]
    public async Task<IActionResult> GetWorkflowDiagnostics(string entityType, Guid entityId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        var runtime = await _workflowRuntimeTracker.GetAsync(connectionString, entityType, entityId, ct);
        if (runtime is null)
        {
            return NotFound();
        }

        var history = await _workflowRuntimeTracker.GetHistoryAsync(connectionString, entityType, entityId, ct);
        var actionSnapshot = await _workflowActionGrantService.GetSnapshotAsync(connectionString, User, entityType, entityId, ct);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var routeDecision = await _workflowPolicyGuard.ResolveRouteDecisionAsync(conn, tx, entityType, entityId, ct);
            var checks = new List<AuditTransitionDiagnostic>();
            foreach (var transition in runtime.NextTransitions)
            {
                var result = await _workflowPolicyGuard.EvaluateTransitionAsync(conn, tx, entityType, entityId, transition.ToStageKey, ct);
                checks.Add(new AuditTransitionDiagnostic(
                    transition.ToStageKey,
                    transition.StageTitle,
                    transition.TransitionCondition,
                    result.IsAllowed,
                    result.Message));
            }

            await tx.CommitAsync(ct);

            return Ok(new AuditWorkflowDiagnosticsResponse(
                runtime,
                routeDecision,
                actionSnapshot?.RoleKey,
                actionSnapshot?.Actions ?? Array.Empty<WorkflowGrantedAction>(),
                history.Take(20).ToArray(),
                checks));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error retrieving workflow diagnostics for {EntityType} {EntityId}.", entityType, entityId);
            return Problem("Internal server error retrieving workflow diagnostics.");
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

            // Verify paid status for contracts
            if (entityType == "contract")
            {
                const string checkPaidSql = "SELECT is_paid FROM post_award.contracts WHERE contract_id = @p_contract_id;";
                await using var checkPaidCmd = new NpgsqlCommand(checkPaidSql, conn, tx);
                checkPaidCmd.Parameters.AddWithValue("p_contract_id", request.EntityId);
                var isPaid = await checkPaidCmd.ExecuteScalarAsync(ct);
                if (isPaid is not bool paid || !paid)
                {
                    return BadRequest("Contract must be recorded as Paid before closeout.");
                }
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
            reader.GetString(reader.GetOrdinal("summary")),
            GetNullableString(reader, "archive_location"),
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
    summary,
    archive_location,
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

using eProcurement.Modules.Governance.DTOs;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Governance.Controllers;

public partial class AuditController
{
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
}

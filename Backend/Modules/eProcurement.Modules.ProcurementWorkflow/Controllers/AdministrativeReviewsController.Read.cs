using eProcurement.Modules.ProcurementWorkflow.DTOs;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class AdministrativeReviewsController
{
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
    pc.complaint_id,
    pc.complaint_reference,
    pc.entity_type,
    pc.entity_id,
    pc.stage_key_at_filing,
    pc.status,
    pc.subject,
    pc.summary,
    pc.details,
    pc.complaint_channel,
    pc.requested_remedy,
    pc.filed_by,
    pc.assigned_to,
    pc.reviewed_by,
    pc.resolution_outcome,
    pc.resolution_stage_key,
    pc.resolution_notes,
    pc.filed_at,
    pc.reviewed_at,
    pc.resolved_at,
    pc.created_at,
    pc.updated_at,
    wi.record_title AS parent_record_title,
    wi.current_stage_key AS parent_current_stage_key,
    wsc.stage_title AS parent_current_stage_title,
    wi.current_status AS parent_current_status
FROM procurement_workflow.procurement_complaints pc
LEFT JOIN procurement_workflow.workflow_instances wi
  ON wi.entity_type = pc.entity_type
 AND wi.entity_id = pc.entity_id
LEFT JOIN procurement_workflow.workflow_stage_catalog wsc
  ON wsc.stage_key = wi.current_stage_key
WHERE (@p_entity_type IS NULL OR pc.entity_type = @p_entity_type)
  AND (@p_entity_id IS NULL OR pc.entity_id = @p_entity_id)
  AND (@p_status IS NULL OR pc.status = @p_status)
ORDER BY pc.filed_at DESC;";

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
    pc.complaint_id,
    pc.complaint_reference,
    pc.entity_type,
    pc.entity_id,
    pc.stage_key_at_filing,
    pc.status,
    pc.subject,
    pc.summary,
    pc.details,
    pc.complaint_channel,
    pc.requested_remedy,
    pc.filed_by,
    pc.assigned_to,
    pc.reviewed_by,
    pc.resolution_outcome,
    pc.resolution_stage_key,
    pc.resolution_notes,
    pc.filed_at,
    pc.reviewed_at,
    pc.resolved_at,
    pc.created_at,
    pc.updated_at,
    wi.record_title AS parent_record_title,
    wi.current_stage_key AS parent_current_stage_key,
    wsc.stage_title AS parent_current_stage_title,
    wi.current_status AS parent_current_status
FROM procurement_workflow.procurement_complaints pc
LEFT JOIN procurement_workflow.workflow_instances wi
  ON wi.entity_type = pc.entity_type
 AND wi.entity_id = pc.entity_id
LEFT JOIN procurement_workflow.workflow_stage_catalog wsc
  ON wsc.stage_key = wi.current_stage_key
WHERE pc.complaint_id = @p_complaint_id;";

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
            GetNullableDateTime(reader, "resolved_at"),
            GetNullableString(reader, "parent_record_title"),
            GetNullableString(reader, "parent_current_stage_key"),
            GetNullableString(reader, "parent_current_stage_title"),
            GetNullableString(reader, "parent_current_status"));
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
            reader.GetDateTime(reader.GetOrdinal("updated_at")),
            GetNullableString(reader, "parent_record_title"),
            GetNullableString(reader, "parent_current_stage_key"),
            GetNullableString(reader, "parent_current_stage_title"),
            GetNullableString(reader, "parent_current_status"));
    }
}

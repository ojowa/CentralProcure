using eProcurement.Modules.ProcurementWorkflow.DTOs;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class ProcurementPlansController
{
    [HttpGet("{planId:guid}/requisitions")]
    public async Task<IActionResult> GetPlanRequisitions(Guid planId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            var planExists = await PlanExistsAsync(conn, tx, planId, ct);
            if (!planExists)
                return NotFound();

            var requisitions = await GetPlanRequisitionsAsync(conn, tx, planId, ct);
            await tx.CommitAsync(ct);
            return Ok(requisitions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving requisitions for procurement plan {PlanId}.", planId);
            return Problem("Internal server error retrieving procurement plan requisitions.");
        }
    }

    private static async Task<bool> PlanExistsAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid planId, CancellationToken ct)
    {
        const string sql = "SELECT EXISTS (SELECT 1 FROM procurement_workflow.procurement_plans WHERE plan_id = @p_plan_id);";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is bool exists && exists;
    }

    private static async Task<List<RequisitionSummary>> GetPlanRequisitionsAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid planId, CancellationToken ct)
    {
        const string sql = """
WITH linked_requisitions AS (
    SELECT l.requisition_id
    FROM procurement_workflow.planning_committee_plan_links l
    WHERE l.plan_id = @p_plan_id
    UNION
    SELECT r.requisition_id
    FROM procurement_workflow.requisitions r
    JOIN procurement_workflow.procurement_plan_items i ON i.plan_item_id = r.app_item_id
    WHERE i.plan_id = @p_plan_id
)
SELECT r.requisition_id, r.title, r.department, r.unit_id, l.plan_id AS committee_plan_id, p.plan_title AS committee_plan_title,
       r.app_item_id, i.description AS app_item_description, d.overall_decision AS final_committee_decision, r.status, r.priority,
       r.funding_source, r.total_estimate, r.required_by, r.created_at
FROM linked_requisitions x
JOIN procurement_workflow.requisitions r ON r.requisition_id = x.requisition_id
LEFT JOIN procurement_workflow.planning_committee_plan_links l ON l.requisition_id = r.requisition_id
LEFT JOIN procurement_workflow.procurement_plans p ON p.plan_id = COALESCE(l.plan_id, @p_plan_id)
LEFT JOIN procurement_workflow.procurement_plan_items i ON i.plan_item_id = r.app_item_id
LEFT JOIN procurement_workflow.planning_committee_decisions d ON d.requisition_id = r.requisition_id
ORDER BY r.created_at DESC;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<RequisitionSummary>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(new RequisitionSummary(
                reader.GetGuid(reader.GetOrdinal("requisition_id")),
                reader.GetString(reader.GetOrdinal("title")),
                reader.GetString(reader.GetOrdinal("department")),
                reader.IsDBNull(reader.GetOrdinal("unit_id")) ? null : reader.GetGuid(reader.GetOrdinal("unit_id")),
                reader.IsDBNull(reader.GetOrdinal("committee_plan_id")) ? null : reader.GetGuid(reader.GetOrdinal("committee_plan_id")),
                GetNullableString(reader, "committee_plan_title"),
                reader.IsDBNull(reader.GetOrdinal("app_item_id")) ? null : reader.GetGuid(reader.GetOrdinal("app_item_id")),
                GetNullableString(reader, "app_item_description"),
                GetNullableString(reader, "final_committee_decision"),
                reader.GetString(reader.GetOrdinal("status")),
                GetNullableString(reader, "priority"),
                GetNullableString(reader, "funding_source"),
                reader.GetFieldValue<decimal>(reader.GetOrdinal("total_estimate")),
                GetNullableDateTime(reader, "required_by"),
                reader.GetDateTime(reader.GetOrdinal("created_at"))));
        }

        return results;
    }

    private static string? GetNullableString(NpgsqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    private static DateTime? GetNullableDateTime(NpgsqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
    }
}

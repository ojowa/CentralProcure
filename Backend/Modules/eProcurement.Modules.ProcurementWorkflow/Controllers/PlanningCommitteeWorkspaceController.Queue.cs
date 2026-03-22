using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class PlanningCommitteeWorkspaceController
{
    private static async Task<List<RequisitionSummary>> GetQueueRequisitionsAsync(NpgsqlConnection conn, NpgsqlTransaction tx, CancellationToken ct)
    {
        const string sql = """
SELECT r.requisition_id, r.title, r.department, r.unit_id, l.plan_id AS committee_plan_id, p.plan_title AS committee_plan_title,
       r.app_item_id, i.description AS app_item_description, d.overall_decision AS final_committee_decision, r.status, r.priority,
       r.funding_source, r.total_estimate, r.required_by, r.created_at
FROM procurement_workflow.requisitions r
LEFT JOIN procurement_workflow.planning_committee_plan_links l ON l.requisition_id = r.requisition_id
LEFT JOIN procurement_workflow.procurement_plans p ON p.plan_id = l.plan_id
LEFT JOIN procurement_workflow.procurement_plan_items i ON i.plan_item_id = r.app_item_id
LEFT JOIN procurement_workflow.planning_committee_decisions d ON d.requisition_id = r.requisition_id
WHERE r.status ILIKE 'Under Review'
ORDER BY r.created_at DESC;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var items = new List<RequisitionSummary>();
        while (await reader.ReadAsync(ct))
        {
            items.Add(MapSummary(reader));
        }

        return items;
    }

    private static async Task<List<ProcurementPlanSummary>> GetAvailablePlansAsync(NpgsqlConnection conn, NpgsqlTransaction tx, CancellationToken ct)
    {
        const string sql = """
SELECT plan_id, plan_title, department, fiscal_year, status, total_budget, created_at
FROM procurement_workflow.procurement_plans
WHERE status ILIKE 'Under Review'
ORDER BY created_at DESC;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<ProcurementPlanSummary>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(new ProcurementPlanSummary(
                reader.GetGuid(reader.GetOrdinal("plan_id")),
                reader.GetString(reader.GetOrdinal("plan_title")),
                reader.GetString(reader.GetOrdinal("department")),
                reader.GetInt32(reader.GetOrdinal("fiscal_year")),
                reader.GetString(reader.GetOrdinal("status")),
                reader.GetFieldValue<decimal>(reader.GetOrdinal("total_budget")),
                reader.GetDateTime(reader.GetOrdinal("created_at"))));
        }

        return results;
    }

    private static async Task<RequisitionSummary?> GetRequisitionSummaryAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid requisitionId, CancellationToken ct)
    {
        const string sql = """
SELECT r.requisition_id, r.title, r.department, r.unit_id, l.plan_id AS committee_plan_id, p.plan_title AS committee_plan_title,
       r.app_item_id, i.description AS app_item_description, d.overall_decision AS final_committee_decision, r.status, r.priority,
       r.funding_source, r.total_estimate, r.required_by, r.created_at
FROM procurement_workflow.requisitions r
LEFT JOIN procurement_workflow.planning_committee_plan_links l ON l.requisition_id = r.requisition_id
LEFT JOIN procurement_workflow.procurement_plans p ON p.plan_id = l.plan_id
LEFT JOIN procurement_workflow.procurement_plan_items i ON i.plan_item_id = r.app_item_id
LEFT JOIN procurement_workflow.planning_committee_decisions d ON d.requisition_id = r.requisition_id
WHERE r.requisition_id = @p_requisition_id;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? MapSummary(reader) : null;
    }

    private static async Task<Guid?> GetPlanIdFromAppItemAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid requisitionId, CancellationToken ct)
    {
        const string sql = """
SELECT i.plan_id
FROM procurement_workflow.requisitions r
JOIN procurement_workflow.procurement_plan_items i ON i.plan_item_id = r.app_item_id
WHERE r.requisition_id = @p_requisition_id;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is null || result is DBNull ? null : (Guid?)result;
    }

    private static async Task<ProcurementPlanDetail?> GetPlanDetailAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid planId, CancellationToken ct)
    {
        const string sql = """
SELECT p.plan_id, p.plan_title, p.department, p.fiscal_year, p.status, wi.current_stage_key, sc.stage_title AS current_stage_title,
       p.total_budget, p.notes, p.submitted_at, p.approved_at, p.created_at, p.updated_at
FROM procurement_workflow.procurement_plans p
LEFT JOIN procurement_workflow.workflow_instances wi ON wi.entity_type = 'procurement_plan' AND wi.entity_id = p.plan_id
LEFT JOIN procurement_workflow.workflow_stage_catalog sc ON sc.stage_key = wi.current_stage_key
WHERE p.plan_id = @p_plan_id;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new ProcurementPlanDetail(
            reader.GetGuid(reader.GetOrdinal("plan_id")),
            reader.GetString(reader.GetOrdinal("plan_title")),
            reader.GetString(reader.GetOrdinal("department")),
            reader.GetInt32(reader.GetOrdinal("fiscal_year")),
            reader.GetString(reader.GetOrdinal("status")),
            GetNullableString(reader, "current_stage_key"),
            GetNullableString(reader, "current_stage_title"),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("total_budget")),
            GetNullableString(reader, "notes"),
            GetNullableDateTime(reader, "submitted_at"),
            GetNullableDateTime(reader, "approved_at"),
            reader.GetDateTime(reader.GetOrdinal("created_at")),
            reader.GetDateTime(reader.GetOrdinal("updated_at")));
    }

    private static async Task<List<ProcurementPlanItemDetail>> GetPlanItemsAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid planId, CancellationToken ct)
    {
        const string sql = """
SELECT i.plan_item_id, i.plan_id, i.item_code, i.description, i.budget_code, i.procurement_type, i.estimated_amount, i.status, i.notes, i.created_at, i.updated_at
FROM procurement_workflow.procurement_plan_items i
WHERE i.plan_id = @p_plan_id
ORDER BY i.created_at ASC;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<ProcurementPlanItemDetail>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(new ProcurementPlanItemDetail(
                reader.GetGuid(reader.GetOrdinal("plan_item_id")),
                reader.GetGuid(reader.GetOrdinal("plan_id")),
                GetNullableString(reader, "item_code"),
                reader.GetString(reader.GetOrdinal("description")),
                reader.GetString(reader.GetOrdinal("budget_code")),
                GetNullableString(reader, "procurement_type"),
                reader.GetFieldValue<decimal>(reader.GetOrdinal("estimated_amount")),
                reader.GetString(reader.GetOrdinal("status")),
                GetNullableString(reader, "notes"),
                reader.GetDateTime(reader.GetOrdinal("created_at")),
                reader.GetDateTime(reader.GetOrdinal("updated_at"))));
        }

        return results;
    }
}

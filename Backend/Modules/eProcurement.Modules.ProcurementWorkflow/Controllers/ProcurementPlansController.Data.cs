using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class ProcurementPlansController
{
    private static async Task<List<T>> ExecuteRefcursorAsync<T>(NpgsqlCommand cmd, Func<NpgsqlDataReader, T> map, CancellationToken ct)
    {
        await cmd.ExecuteNonQueryAsync(ct);
        var cursorName = (string)cmd.Parameters["p_result"].Value!;
        await using var fetch = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", cmd.Connection!, cmd.Transaction);
        await using var reader = await fetch.ExecuteReaderAsync(ct);
        var results = new List<T>();
        while (await reader.ReadAsync(ct))
            results.Add(map(reader));
        return results;
    }

    private static ProcurementPlanSummary MapPlanSummary(NpgsqlDataReader r) => new(
        r.GetGuid(r.GetOrdinal("plan_id")),
        r.GetString(r.GetOrdinal("plan_title")),
        r.GetString(r.GetOrdinal("department")),
        r.GetInt32(r.GetOrdinal("fiscal_year")),
        r.GetString(r.GetOrdinal("status")),
        GetOptionalNullableString(r, "current_stage_key"),
        GetOptionalNullableString(r, "current_stage_title"),
        r.GetFieldValue<decimal>(r.GetOrdinal("total_budget")),
        r.GetDateTime(r.GetOrdinal("created_at")),
        GetOptionalNullableGuid(r, "yearly_app_id"),
        GetOptionalNullableString(r, "yearly_app_title"));

    private static ProcurementPlanDetail MapPlanDetail(NpgsqlDataReader r) => new(
        r.GetGuid(r.GetOrdinal("plan_id")),
        r.GetString(r.GetOrdinal("plan_title")),
        r.GetString(r.GetOrdinal("department")),
        r.GetInt32(r.GetOrdinal("fiscal_year")),
        r.GetString(r.GetOrdinal("status")),
        GetOptionalNullableString(r, "current_stage_key"),
        GetOptionalNullableString(r, "current_stage_title"),
        r.GetFieldValue<decimal>(r.GetOrdinal("total_budget")),
        GetOptionalNullableString(r, "notes"),
        GetOptionalNullableDateTime(r, "submitted_at"),
        GetOptionalNullableDateTime(r, "approved_at"),
        r.GetDateTime(r.GetOrdinal("created_at")),
        r.GetDateTime(r.GetOrdinal("updated_at")),
        GetOptionalNullableGuid(r, "yearly_app_id"),
        GetOptionalNullableString(r, "yearly_app_title"));

    private static ProcurementPlanItemDetail MapPlanItemDetail(NpgsqlDataReader r) => new(
        r.GetGuid(r.GetOrdinal("plan_item_id")),
        r.GetGuid(r.GetOrdinal("plan_id")),
        GetOptionalNullableString(r, "item_code"),
        r.GetString(r.GetOrdinal("description")),
        r.GetString(r.GetOrdinal("budget_code")),
        GetOptionalNullableString(r, "procurement_type"),
        r.GetFieldValue<decimal>(r.GetOrdinal("estimated_amount")),
        r.GetString(r.GetOrdinal("status")),
        GetOptionalNullableString(r, "notes"),
        r.GetDateTime(r.GetOrdinal("created_at")),
        r.GetDateTime(r.GetOrdinal("updated_at")));

    private static string? GetOptionalNullableString(NpgsqlDataReader r, string name)
    {
        var ordinal = TryGetOrdinal(r, name);
        return ordinal.HasValue && !r.IsDBNull(ordinal.Value) ? r.GetString(ordinal.Value) : null;
    }

    private static Guid? GetOptionalNullableGuid(NpgsqlDataReader r, string name)
    {
        var ordinal = TryGetOrdinal(r, name);
        return ordinal.HasValue && !r.IsDBNull(ordinal.Value) ? r.GetGuid(ordinal.Value) : null;
    }

    private static DateTime? GetOptionalNullableDateTime(NpgsqlDataReader r, string name)
    {
        var ordinal = TryGetOrdinal(r, name);
        return ordinal.HasValue && !r.IsDBNull(ordinal.Value) ? r.GetDateTime(ordinal.Value) : null;
    }

    private static int? TryGetOrdinal(NpgsqlDataReader reader, string name)
    {
        try { return reader.GetOrdinal(name); }
        catch (IndexOutOfRangeException) { return null; }
    }

    private static async Task<ProcurementPlanDetail?> GetPlanDetailAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid planId, CancellationToken ct)
    {
        const string sql = """
SELECT p.plan_id, p.plan_title, p.department, p.fiscal_year, p.status,
       wi.current_stage_key, sc.stage_title AS current_stage_title,
       CASE WHEN calc.item_count > 0 THEN calc.calculated_total_budget ELSE p.total_budget END AS total_budget,
       p.notes, p.submitted_at, p.approved_at, p.created_at, p.updated_at,
       y.yearly_app_id, y.title AS yearly_app_title
FROM procurement_workflow.procurement_plans p
LEFT JOIN procurement_workflow.workflow_instances wi ON wi.entity_type = 'procurement_plan' AND wi.entity_id = p.plan_id
LEFT JOIN procurement_workflow.workflow_stage_catalog sc ON sc.stage_key = wi.current_stage_key
LEFT JOIN procurement_workflow.yearly_apps y ON y.yearly_app_id = p.yearly_app_id
LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(i.estimated_amount), 0)::numeric AS calculated_total_budget,
           COUNT(i.plan_item_id)::int AS item_count
    FROM procurement_workflow.procurement_plan_items i
    WHERE i.plan_id = p.plan_id
      AND (
            NOT EXISTS (SELECT 1 FROM procurement_workflow.requisitions r WHERE r.app_item_id = i.plan_item_id)
            OR EXISTS (
                SELECT 1
                FROM procurement_workflow.requisitions r
                JOIN procurement_workflow.planning_committee_decisions d ON d.requisition_id = r.requisition_id
                WHERE r.app_item_id = i.plan_item_id
                  AND d.overall_decision = 'Recommended'
            )
          )
) calc ON TRUE
WHERE p.plan_id = @p_plan_id;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? MapPlanDetail(reader) : null;
    }

    private static async Task<List<ProcurementPlanItemDetail>> GetPlanItemsAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid planId, CancellationToken ct)
    {
        const string sql = """
SELECT i.plan_item_id, i.plan_id, i.item_code, i.description, i.budget_code, i.procurement_type,
       i.estimated_amount, i.status, i.notes, i.created_at, i.updated_at
FROM procurement_workflow.procurement_plan_items i
WHERE i.plan_id = @p_plan_id
  AND (
        NOT EXISTS (SELECT 1 FROM procurement_workflow.requisitions r WHERE r.app_item_id = i.plan_item_id)
        OR EXISTS (
            SELECT 1
            FROM procurement_workflow.requisitions r
            JOIN procurement_workflow.planning_committee_decisions d ON d.requisition_id = r.requisition_id
            WHERE r.app_item_id = i.plan_item_id
              AND d.overall_decision = 'Recommended'
        )
      )
ORDER BY i.created_at ASC;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<ProcurementPlanItemDetail>();
        while (await reader.ReadAsync(ct))
            results.Add(MapPlanItemDetail(reader));
        return results;
    }

    private async Task SyncWorkflowRuntimeAsync(NpgsqlConnection conn, NpgsqlTransaction tx, ProcurementPlanDetail plan, string reason, CancellationToken ct)
    {
        await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest(
            "procurement_plan", plan.PlanId, ResolveWorkflowStage(plan.Status), plan.Status, plan.PlanTitle,
            null, null, plan.TotalBudget, null, null, reason, null), ct);
    }

    private static string ResolveWorkflowStage(string status) => status switch
    {
        "Draft" => "department_need_capture",
        "Submitted" => "comptroller_procurement_review",
        "Under Review" => "planning_committee_review",
        _ => "app_approval"
    };
}

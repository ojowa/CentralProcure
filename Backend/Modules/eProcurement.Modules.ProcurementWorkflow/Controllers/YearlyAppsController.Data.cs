using eProcurement.Modules.ProcurementWorkflow.DTOs;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class YearlyAppsController
{
    private sealed record YearlyAppPlanGroups(
        IReadOnlyList<YearlyAppPlanSummary> IncludedPlans,
        IReadOnlyList<YearlyAppPlanSummary> PendingPlans);

    private static async Task<List<YearlyAppSummary>> GetYearlyAppSummariesAsync(NpgsqlConnection conn, NpgsqlTransaction tx, CancellationToken ct)
    {
        const string sql = """
WITH plan_rollup AS (
    SELECT p.plan_id, p.yearly_app_id, p.status, wi.current_stage_key,
           CASE WHEN calc.item_count > 0 THEN calc.calculated_total_budget ELSE p.total_budget END AS effective_total_budget,
           calc.item_count
    FROM procurement_workflow.procurement_plans p
    LEFT JOIN procurement_workflow.workflow_instances wi
      ON wi.entity_type = 'procurement_plan'
     AND wi.entity_id = p.plan_id
    LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(i.estimated_amount), 0)::numeric AS calculated_total_budget,
               COUNT(i.plan_item_id)::int AS item_count
        FROM procurement_workflow.procurement_plan_items i
        WHERE i.plan_id = p.plan_id
    ) calc ON TRUE
)
SELECT y.yearly_app_id, y.title, y.fiscal_year, y.status, wi.current_stage_key, sc.stage_title AS current_stage_title,
       (COUNT(DISTINCT pr.plan_id) FILTER (
            WHERE pr.status = 'Approved'
               OR COALESCE(pr.current_stage_key, '') = 'app_approval'
        ))::int AS plans_count,
       COUNT(DISTINCT pr.plan_id) FILTER (WHERE pr.status = 'Approved')::int AS included_plans_count,
       COUNT(DISTINCT pr.plan_id) FILTER (
           WHERE pr.status <> 'Approved'
             AND COALESCE(pr.current_stage_key, '') = 'app_approval'
       )::int AS pending_plans_count,
       COALESCE(SUM(pr.item_count) FILTER (WHERE pr.status = 'Approved'), 0)::int AS items_count,
       COALESCE(SUM(pr.effective_total_budget) FILTER (WHERE pr.status = 'Approved'), 0)::numeric AS total_budget,
       y.created_at
FROM procurement_workflow.yearly_apps y
LEFT JOIN plan_rollup pr ON pr.yearly_app_id = y.yearly_app_id
LEFT JOIN procurement_workflow.workflow_instances wi ON wi.entity_type = 'yearly_app' AND wi.entity_id = y.yearly_app_id
LEFT JOIN procurement_workflow.workflow_stage_catalog sc ON sc.stage_key = wi.current_stage_key
GROUP BY y.yearly_app_id, y.title, y.fiscal_year, y.status, wi.current_stage_key, sc.stage_title, y.created_at
ORDER BY y.fiscal_year DESC;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<YearlyAppSummary>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(new YearlyAppSummary(
                reader.GetGuid(reader.GetOrdinal("yearly_app_id")),
                reader.GetString(reader.GetOrdinal("title")),
                reader.GetInt32(reader.GetOrdinal("fiscal_year")),
                reader.GetString(reader.GetOrdinal("status")),
                GetNullableString(reader, "current_stage_key"),
                GetNullableString(reader, "current_stage_title"),
                reader.GetInt32(reader.GetOrdinal("plans_count")),
                reader.GetInt32(reader.GetOrdinal("included_plans_count")),
                reader.GetInt32(reader.GetOrdinal("pending_plans_count")),
                reader.GetInt32(reader.GetOrdinal("items_count")),
                reader.GetDecimal(reader.GetOrdinal("total_budget")),
                reader.GetDateTime(reader.GetOrdinal("created_at"))));
        }

        return results;
    }

    private static async Task<YearlyAppDetail?> GetYearlyAppDetailAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid yearlyAppId, CancellationToken ct)
    {
        const string sql = """
WITH plan_rollup AS (
    SELECT p.plan_id, p.yearly_app_id, p.status, wi.current_stage_key,
           CASE WHEN calc.item_count > 0 THEN calc.calculated_total_budget ELSE p.total_budget END AS effective_total_budget,
           calc.item_count
    FROM procurement_workflow.procurement_plans p
    LEFT JOIN procurement_workflow.workflow_instances wi
      ON wi.entity_type = 'procurement_plan'
     AND wi.entity_id = p.plan_id
    LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(i.estimated_amount), 0)::numeric AS calculated_total_budget,
               COUNT(i.plan_item_id)::int AS item_count
        FROM procurement_workflow.procurement_plan_items i
        WHERE i.plan_id = p.plan_id
    ) calc ON TRUE
)
SELECT y.yearly_app_id, y.title, y.fiscal_year, y.status, wi.current_stage_key, sc.stage_title AS current_stage_title,
       COALESCE(SUM(pr.effective_total_budget) FILTER (WHERE pr.status = 'Approved'), 0)::numeric AS total_budget,
       (COUNT(DISTINCT pr.plan_id) FILTER (
            WHERE pr.status = 'Approved'
               OR COALESCE(pr.current_stage_key, '') = 'app_approval'
        ))::int AS plans_count,
       COUNT(DISTINCT pr.plan_id) FILTER (WHERE pr.status = 'Approved')::int AS included_plans_count,
       COUNT(DISTINCT pr.plan_id) FILTER (
           WHERE pr.status <> 'Approved'
             AND COALESCE(pr.current_stage_key, '') = 'app_approval'
       )::int AS pending_plans_count,
       COALESCE(SUM(pr.item_count) FILTER (WHERE pr.status = 'Approved'), 0)::int AS items_count,
       y.notes, y.submitted_at, y.approved_at, y.created_at, y.updated_at
FROM procurement_workflow.yearly_apps y
LEFT JOIN plan_rollup pr ON pr.yearly_app_id = y.yearly_app_id
LEFT JOIN procurement_workflow.workflow_instances wi ON wi.entity_type = 'yearly_app' AND wi.entity_id = y.yearly_app_id
LEFT JOIN procurement_workflow.workflow_stage_catalog sc ON sc.stage_key = wi.current_stage_key
WHERE y.yearly_app_id = @p_yearly_app_id
GROUP BY y.yearly_app_id, y.title, y.fiscal_year, y.status, wi.current_stage_key, sc.stage_title, y.notes, y.submitted_at, y.approved_at, y.created_at, y.updated_at;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_yearly_app_id", NpgsqlDbType.Uuid, yearlyAppId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
            return null;

        return new YearlyAppDetail(
            reader.GetGuid(reader.GetOrdinal("yearly_app_id")),
            reader.GetString(reader.GetOrdinal("title")),
            reader.GetInt32(reader.GetOrdinal("fiscal_year")),
            reader.GetString(reader.GetOrdinal("status")),
            GetNullableString(reader, "current_stage_key"),
            GetNullableString(reader, "current_stage_title"),
            reader.GetDecimal(reader.GetOrdinal("total_budget")),
            reader.GetInt32(reader.GetOrdinal("plans_count")),
            reader.GetInt32(reader.GetOrdinal("included_plans_count")),
            reader.GetInt32(reader.GetOrdinal("pending_plans_count")),
            reader.GetInt32(reader.GetOrdinal("items_count")),
            GetNullableString(reader, "notes"),
            GetNullableDateTime(reader, "submitted_at"),
            GetNullableDateTime(reader, "approved_at"),
            reader.GetDateTime(reader.GetOrdinal("created_at")),
            reader.GetDateTime(reader.GetOrdinal("updated_at")));
    }

    private static async Task<YearlyAppPlanGroups> GetYearlyAppPlanGroupsAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid yearlyAppId, CancellationToken ct)
    {
        const string sql = """
SELECT p.plan_id, p.plan_title, p.department, p.fiscal_year, p.status, wi.current_stage_key,
       sc.stage_title AS current_stage_title,
       CASE WHEN calc.item_count > 0 THEN calc.calculated_total_budget ELSE p.total_budget END AS total_budget,
       calc.item_count, p.created_at
FROM procurement_workflow.procurement_plans p
LEFT JOIN procurement_workflow.workflow_instances wi ON wi.entity_type = 'procurement_plan' AND wi.entity_id = p.plan_id
LEFT JOIN procurement_workflow.workflow_stage_catalog sc ON sc.stage_key = wi.current_stage_key
LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(i.estimated_amount), 0)::numeric AS calculated_total_budget,
           COUNT(i.plan_item_id)::int AS item_count
    FROM procurement_workflow.procurement_plan_items i
    WHERE i.plan_id = p.plan_id
) calc ON TRUE
WHERE p.yearly_app_id = @p_yearly_app_id
ORDER BY p.department ASC, p.plan_title ASC;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_yearly_app_id", NpgsqlDbType.Uuid, yearlyAppId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var includedPlans = new List<YearlyAppPlanSummary>();
        var pendingPlans = new List<YearlyAppPlanSummary>();
        while (await reader.ReadAsync(ct))
        {
            var plan = new YearlyAppPlanSummary(
                reader.GetGuid(reader.GetOrdinal("plan_id")),
                reader.GetString(reader.GetOrdinal("plan_title")),
                reader.GetString(reader.GetOrdinal("department")),
                reader.GetInt32(reader.GetOrdinal("fiscal_year")),
                reader.GetString(reader.GetOrdinal("status")),
                GetNullableString(reader, "current_stage_key"),
                GetNullableString(reader, "current_stage_title"),
                reader.GetDecimal(reader.GetOrdinal("total_budget")),
                reader.GetInt32(reader.GetOrdinal("item_count")),
                reader.GetDateTime(reader.GetOrdinal("created_at")));

            if (IsIncludedInYearlyApp(plan))
                includedPlans.Add(plan);
            else if (IsPendingInYearlyApp(plan))
                pendingPlans.Add(plan);
        }

        return new YearlyAppPlanGroups(includedPlans, pendingPlans);
    }

    private static bool IsIncludedInYearlyApp(YearlyAppPlanSummary plan) =>
        string.Equals(plan.Status, "Approved", StringComparison.OrdinalIgnoreCase);

    private static bool IsPendingInYearlyApp(YearlyAppPlanSummary plan) =>
        !string.Equals(plan.Status, "Approved", StringComparison.OrdinalIgnoreCase) &&
        string.Equals(plan.CurrentStageKey, "app_approval", StringComparison.OrdinalIgnoreCase);

    private static string? GetNullableString(NpgsqlDataReader r, string name)
    {
        var ordinal = r.GetOrdinal(name);
        return r.IsDBNull(ordinal) ? null : r.GetString(ordinal);
    }

    private static DateTime? GetNullableDateTime(NpgsqlDataReader r, string name)
    {
        var ordinal = r.GetOrdinal(name);
        return r.IsDBNull(ordinal) ? null : r.GetDateTime(ordinal);
    }
}

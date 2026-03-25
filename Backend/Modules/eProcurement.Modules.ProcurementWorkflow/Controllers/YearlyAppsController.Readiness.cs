using eProcurement.Modules.ProcurementWorkflow.DTOs;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class YearlyAppsController
{
    private sealed record RecommendationReadiness(
        int TotalTrackedRequisitions,
        int RecommendedRequisitions,
        int PendingFinalDecisionRequisitions,
        int NonRecommendedRequisitions,
        int AppItemCount,
        bool IsReady,
        string? Message,
        IReadOnlyList<ProcurementPlanRecommendationRequisitionResponse> Requisitions);

    private static async Task<RecommendationReadiness> ValidateRecommendationReadinessAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid yearlyAppId, CancellationToken ct)
    {
        const string summarySql = """
WITH tracked_requisitions AS (
    SELECT DISTINCT l.requisition_id
    FROM procurement_workflow.planning_committee_plan_links l
    JOIN procurement_workflow.procurement_plans p ON p.plan_id = l.plan_id
    WHERE p.yearly_app_id = @p_yearly_app_id
    UNION
    SELECT DISTINCT d.requisition_id
    FROM procurement_workflow.planning_committee_decisions d
    JOIN procurement_workflow.procurement_plans p ON p.plan_id = d.plan_id
    WHERE p.yearly_app_id = @p_yearly_app_id
),
decision_rollup AS (
    SELECT tr.requisition_id, d.overall_decision, r.app_item_id
    FROM tracked_requisitions tr
    LEFT JOIN procurement_workflow.planning_committee_decisions d ON d.requisition_id = tr.requisition_id
    LEFT JOIN procurement_workflow.requisitions r ON r.requisition_id = tr.requisition_id
)
SELECT
    (SELECT COUNT(*)::int FROM tracked_requisitions) AS total_tracked_requisitions,
    COALESCE(SUM(CASE WHEN overall_decision = 'Recommended' THEN 1 ELSE 0 END), 0)::int AS recommended_requisitions,
    COALESCE(SUM(CASE WHEN overall_decision IS NULL THEN 1 ELSE 0 END), 0)::int AS pending_final_decision_requisitions,
    COALESCE(SUM(CASE WHEN overall_decision IS NOT NULL AND overall_decision <> 'Recommended' THEN 1 ELSE 0 END), 0)::int AS non_recommended_requisitions,
    COALESCE(SUM(CASE WHEN app_item_id IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS app_item_count
FROM decision_rollup;
""";
        await using var cmd = new NpgsqlCommand(summarySql, conn, tx);
        cmd.Parameters.AddWithValue("p_yearly_app_id", NpgsqlDbType.Uuid, yearlyAppId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
            return new RecommendationReadiness(0, 0, 0, 0, 0, false, "Unable to validate yearly APP recommendation readiness.", []);

        var totalTrackedRequisitions = reader.GetInt32(reader.GetOrdinal("total_tracked_requisitions"));
        var recommendedRequisitions = reader.GetInt32(reader.GetOrdinal("recommended_requisitions"));
        var pendingFinalDecisionRequisitions = reader.GetInt32(reader.GetOrdinal("pending_final_decision_requisitions"));
        var nonRecommendedRequisitions = reader.GetInt32(reader.GetOrdinal("non_recommended_requisitions"));
        var appItemCount = reader.GetInt32(reader.GetOrdinal("app_item_count"));
        await reader.CloseAsync();
        var requisitions = await GetRecommendationRequisitionsAsync(conn, tx, yearlyAppId, ct);
        if (totalTrackedRequisitions <= 0)
            return new RecommendationReadiness(0, 0, 0, 0, appItemCount, false, "Yearly APP has no requisitions tied to planning committee review yet.", requisitions);
        if (pendingFinalDecisionRequisitions > 0)
            return new RecommendationReadiness(totalTrackedRequisitions, recommendedRequisitions, pendingFinalDecisionRequisitions, nonRecommendedRequisitions, appItemCount, false, "All requisitions tied to this yearly APP must complete final planning committee decision before recommendation.", requisitions);
        if (nonRecommendedRequisitions > 0)
            return new RecommendationReadiness(totalTrackedRequisitions, recommendedRequisitions, pendingFinalDecisionRequisitions, nonRecommendedRequisitions, appItemCount, false, "Yearly APP cannot be recommended because one or more tied requisitions were returned or rejected by the planning committee.", requisitions);
        if (recommendedRequisitions != totalTrackedRequisitions || appItemCount < recommendedRequisitions)
            return new RecommendationReadiness(totalTrackedRequisitions, recommendedRequisitions, pendingFinalDecisionRequisitions, nonRecommendedRequisitions, appItemCount, false, "Yearly APP recommendation is blocked until every tied requisition has a final Recommended decision and corresponding APP item.", requisitions);

        return new RecommendationReadiness(totalTrackedRequisitions, recommendedRequisitions, pendingFinalDecisionRequisitions, nonRecommendedRequisitions, appItemCount, true, null, requisitions);
    }

    private static async Task<IReadOnlyList<ProcurementPlanRecommendationRequisitionResponse>> GetRecommendationRequisitionsAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid yearlyAppId, CancellationToken ct)
    {
        const string sql = """
WITH tracked_requisitions AS (
    SELECT DISTINCT l.requisition_id
    FROM procurement_workflow.planning_committee_plan_links l
    JOIN procurement_workflow.procurement_plans p ON p.plan_id = l.plan_id
    WHERE p.yearly_app_id = @p_yearly_app_id
    UNION
    SELECT DISTINCT d.requisition_id
    FROM procurement_workflow.planning_committee_decisions d
    JOIN procurement_workflow.procurement_plans p ON p.plan_id = d.plan_id
    WHERE p.yearly_app_id = @p_yearly_app_id
)
SELECT r.requisition_id, r.title, r.department, r.total_estimate, d.overall_decision, r.app_item_id
FROM tracked_requisitions tr
JOIN procurement_workflow.requisitions r ON r.requisition_id = tr.requisition_id
LEFT JOIN procurement_workflow.planning_committee_decisions d ON d.requisition_id = tr.requisition_id
ORDER BY r.created_at ASC, r.title ASC;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_yearly_app_id", NpgsqlDbType.Uuid, yearlyAppId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<ProcurementPlanRecommendationRequisitionResponse>();
        while (await reader.ReadAsync(ct))
        {
            var decision = GetNullableString(reader, "overall_decision");
            Guid? appItemId = reader.IsDBNull(reader.GetOrdinal("app_item_id")) ? null : reader.GetGuid(reader.GetOrdinal("app_item_id"));
            results.Add(new ProcurementPlanRecommendationRequisitionResponse(
                reader.GetGuid(reader.GetOrdinal("requisition_id")),
                reader.GetString(reader.GetOrdinal("title")),
                reader.GetString(reader.GetOrdinal("department")),
                reader.GetDecimal(reader.GetOrdinal("total_estimate")),
                decision,
                appItemId,
                string.Equals(decision, "Recommended", StringComparison.OrdinalIgnoreCase) && appItemId.HasValue));
        }

        return results;
    }

    private static async Task UpdateYearlyAppAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid yearlyAppId, string status, string note, DateTime submittedAt, CancellationToken ct)
    {
        const string sql = """
UPDATE procurement_workflow.yearly_apps
SET status = @p_status,
    submitted_at = @p_submitted_at,
    notes = CASE
        WHEN NULLIF(BTRIM(notes), '') IS NULL THEN @p_note
        ELSE notes || E'\n\n' || @p_note
    END,
    updated_at = NOW()
WHERE yearly_app_id = @p_yearly_app_id;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_yearly_app_id", NpgsqlDbType.Uuid, yearlyAppId);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, status);
        cmd.Parameters.AddWithValue("p_note", NpgsqlDbType.Text, note);
        cmd.Parameters.AddWithValue("p_submitted_at", NpgsqlDbType.Timestamp, submittedAt);
        if (await cmd.ExecuteNonQueryAsync(ct) == 0)
            throw new InvalidOperationException("Yearly APP could not be updated for recommendation.");
    }
}

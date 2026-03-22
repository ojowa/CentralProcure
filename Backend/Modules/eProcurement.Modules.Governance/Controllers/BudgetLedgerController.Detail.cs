using eProcurement.Modules.Governance.DTOs;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Governance.Controllers;

public partial class BudgetLedgerController
{
    [Authorize]
    [HttpGet("confirmations/{planId:guid}")]
    public async Task<IActionResult> GetBudgetConfirmationDetail(Guid planId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string detailSql = @"
SELECT
    p.plan_id,
    p.plan_title,
    p.department,
    p.fiscal_year,
    p.status AS plan_status,
    p.notes,
    p.total_budget,
    p.created_at,
    p.updated_at,
    COALESCE(items.requested_amount, 0) AS requested_amount,
    COALESCE(items.item_count, 0) AS item_count,
    COALESCE(wi.current_stage_key, CASE WHEN p.status = 'Initial' THEN 'budget_code_allocation' ELSE 'department_need_capture' END) AS current_stage_key,
    COALESCE(sc.stage_title, CASE WHEN p.status = 'Initial' THEN 'Budget Code Allocation' ELSE 'Department Need Capture' END) AS current_stage_title,
    COALESCE(wi.current_status, p.status) AS workflow_status,
    COALESCE(budget.appropriated, 0) AS appropriated,
    COALESCE(budget.released, 0) AS released,
    COALESCE(budget.committed, 0) AS committed,
    COALESCE(budget.spent, 0) AS spent,
    COALESCE(budget.available, 0) AS available
FROM procurement_workflow.procurement_plans p
LEFT JOIN procurement_workflow.workflow_instances wi
    ON wi.entity_type = 'procurement_plan'
   AND wi.entity_id = p.plan_id
LEFT JOIN procurement_workflow.workflow_stage_catalog sc
    ON sc.stage_key = wi.current_stage_key
LEFT JOIN LATERAL (
    SELECT
        COALESCE(SUM(i.estimated_amount), 0) AS requested_amount,
        COUNT(*)::int AS item_count
    FROM procurement_workflow.procurement_plan_items i
    WHERE i.plan_id = p.plan_id
) items ON TRUE
LEFT JOIN LATERAL (
    WITH codes AS (
        SELECT DISTINCT NULLIF(BTRIM(i.budget_code), '') AS budget_code
        FROM procurement_workflow.procurement_plan_items i
        WHERE i.plan_id = p.plan_id
          AND NULLIF(BTRIM(i.budget_code), '') IS NOT NULL
    ),
    appropriation AS (
        SELECT COALESCE(SUM(a.amount), 0) AS amount
        FROM procurement_workflow.budget_appropriations a
        WHERE a.department = p.department
          AND a.fiscal_year = p.fiscal_year
          AND a.status = 'Active'
          AND EXISTS (SELECT 1 FROM codes c WHERE c.budget_code = a.budget_code)
    ),
    releases AS (
        SELECT COALESCE(SUM(r.amount), 0) AS amount
        FROM procurement_workflow.budget_releases r
        JOIN procurement_workflow.budget_appropriations a ON a.appropriation_id = r.appropriation_id
        WHERE a.department = p.department
          AND a.fiscal_year = p.fiscal_year
          AND a.status = 'Active'
          AND EXISTS (SELECT 1 FROM codes c WHERE c.budget_code = a.budget_code)
    ),
    commitments AS (
        SELECT COALESCE(SUM(c.amount), 0) AS amount
        FROM procurement_workflow.budget_commitments c
        WHERE c.department = p.department
          AND c.fiscal_year = p.fiscal_year
          AND c.status IN ('Reserved', 'Committed')
          AND EXISTS (SELECT 1 FROM codes x WHERE x.budget_code = c.budget_code)
    ),
    expenditures AS (
        SELECT COALESCE(SUM(e.amount), 0) AS amount
        FROM procurement_workflow.budget_expenditures e
        JOIN procurement_workflow.budget_commitments c ON c.commitment_id = e.commitment_id
        WHERE c.department = p.department
          AND c.fiscal_year = p.fiscal_year
          AND EXISTS (SELECT 1 FROM codes x WHERE x.budget_code = c.budget_code)
    )
    SELECT
        appropriation.amount AS appropriated,
        releases.amount AS released,
        commitments.amount AS committed,
        expenditures.amount AS spent,
        (CASE WHEN releases.amount > 0 THEN releases.amount ELSE appropriation.amount END) - commitments.amount - expenditures.amount AS available
    FROM appropriation, releases, commitments, expenditures
) budget ON TRUE
WHERE p.plan_id = @p_plan_id;";

        const string lineSql = @"
SELECT
    i.budget_code,
    COALESCE(SUM(i.estimated_amount), 0) AS requested_amount,
    COUNT(*)::int AS item_count
FROM procurement_workflow.procurement_plan_items i
WHERE i.plan_id = @p_plan_id
  AND NULLIF(BTRIM(i.budget_code), '') IS NOT NULL
GROUP BY i.budget_code
ORDER BY requested_amount DESC, i.budget_code ASC;";

        const string planItemSql = @"
SELECT
    i.plan_item_id,
    i.item_code,
    i.description,
    i.budget_code,
    i.procurement_type,
    i.estimated_amount,
    i.status,
    i.notes,
    i.created_at,
    i.updated_at
FROM procurement_workflow.procurement_plan_items i
WHERE i.plan_id = @p_plan_id
ORDER BY i.estimated_amount DESC, i.description ASC;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var detailCmd = new NpgsqlCommand(detailSql, conn);
            detailCmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
            await using var detailReader = await detailCmd.ExecuteReaderAsync(ct);
            if (!await detailReader.ReadAsync(ct))
            {
                return NotFound();
            }

            var detail = MapBudgetConfirmationDetailSummary(detailReader);
            await detailReader.CloseAsync();

            var budgetLines = await LoadBudgetLinesAsync(conn, planId, detail.Department, detail.FiscalYear, lineSql, ct);

            await using var itemCmd = new NpgsqlCommand(planItemSql, conn);
            itemCmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
            var planItems = new List<BudgetPlanItemSummary>();
            await using (var itemReader = await itemCmd.ExecuteReaderAsync(ct))
            {
                while (await itemReader.ReadAsync(ct))
                {
                    planItems.Add(new BudgetPlanItemSummary(
                        itemReader.GetGuid(itemReader.GetOrdinal("plan_item_id")),
                        GetNullableString(itemReader, "item_code"),
                        itemReader.GetString(itemReader.GetOrdinal("description")),
                        itemReader.GetString(itemReader.GetOrdinal("budget_code")),
                        GetNullableString(itemReader, "procurement_type"),
                        itemReader.GetDecimal(itemReader.GetOrdinal("estimated_amount")),
                        itemReader.GetString(itemReader.GetOrdinal("status")),
                        GetNullableString(itemReader, "notes"),
                        itemReader.GetDateTime(itemReader.GetOrdinal("created_at")),
                        itemReader.GetDateTime(itemReader.GetOrdinal("updated_at"))));
                }
            }

            var history = await _workflowRuntimeTracker.GetHistoryAsync(connectionString, "procurement_plan", planId, ct);
            var mappedHistory = history
                .Select(entry => new BudgetDecisionHistoryEntry(
                    entry.HistoryId,
                    entry.FromStageKey,
                    entry.ToStageKey,
                    entry.ToStageTitle,
                    entry.StageStatus,
                    entry.TransitionSource,
                    entry.TransitionReason,
                    entry.Actor,
                    entry.CreatedAt))
                .ToArray();

            return Ok(detail with
            {
                BudgetLines = budgetLines,
                PlanItems = planItems,
                History = mappedHistory
            });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error loading budget detail for plan {PlanId}.", planId);
            return Problem("Internal server error loading budget detail.");
        }
    }

    private static BudgetConfirmationDetail MapBudgetConfirmationDetailSummary(NpgsqlDataReader reader)
    {
        var requestedAmount = reader.GetDecimal(reader.GetOrdinal("requested_amount"));
        var available = reader.GetDecimal(reader.GetOrdinal("available"));
        return new BudgetConfirmationDetail(
            reader.GetGuid(reader.GetOrdinal("plan_id")),
            reader.GetString(reader.GetOrdinal("plan_title")),
            reader.GetString(reader.GetOrdinal("department")),
            reader.GetInt32(reader.GetOrdinal("fiscal_year")),
            reader.GetString(reader.GetOrdinal("plan_status")),
            reader.GetString(reader.GetOrdinal("current_stage_key")),
            reader.GetString(reader.GetOrdinal("current_stage_title")),
            GetNullableString(reader, "workflow_status"),
            GetNullableString(reader, "notes"),
            reader.GetDecimal(reader.GetOrdinal("total_budget")),
            requestedAmount,
            reader.GetDecimal(reader.GetOrdinal("appropriated")),
            reader.GetDecimal(reader.GetOrdinal("released")),
            reader.GetDecimal(reader.GetOrdinal("committed")),
            reader.GetDecimal(reader.GetOrdinal("spent")),
            available,
            Math.Max(requestedAmount - available, 0),
            reader.GetInt32(reader.GetOrdinal("item_count")),
            reader.GetDateTime(reader.GetOrdinal("created_at")),
            reader.GetDateTime(reader.GetOrdinal("updated_at")),
            WorkflowDisplayMapper.Build(
                reader.GetString(reader.GetOrdinal("current_stage_key")),
                reader.GetString(reader.GetOrdinal("current_stage_title"))),
            Array.Empty<BudgetPlanBudgetLine>(),
            Array.Empty<BudgetPlanItemSummary>(),
            Array.Empty<BudgetDecisionHistoryEntry>());
    }

    private static async Task<IReadOnlyList<BudgetPlanBudgetLine>> LoadBudgetLinesAsync(
        NpgsqlConnection conn,
        Guid planId,
        string department,
        int fiscalYear,
        string lineSql,
        CancellationToken ct)
    {
        await using var lineCmd = new NpgsqlCommand(lineSql, conn);
        lineCmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);

        var lines = new List<BudgetPlanBudgetLine>();
        await using var reader = await lineCmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            lines.Add(new BudgetPlanBudgetLine(
                reader.GetString(reader.GetOrdinal("budget_code")),
                reader.GetDecimal(reader.GetOrdinal("requested_amount")),
                0,
                0,
                0,
                0,
                0,
                0,
                reader.GetInt32(reader.GetOrdinal("item_count"))));
        }

        await reader.CloseAsync();
        if (lines.Count == 0)
        {
            return lines;
        }

        const string budgetSql = @"
WITH appropriation AS (
    SELECT COALESCE(SUM(a.amount), 0) AS appropriated
    FROM procurement_workflow.budget_appropriations a
    WHERE a.budget_code = @p_budget_code
      AND a.department = @p_department
      AND a.fiscal_year = @p_fiscal_year
      AND a.status = 'Active'
),
releases AS (
    SELECT COALESCE(SUM(r.amount), 0) AS released
    FROM procurement_workflow.budget_releases r
    JOIN procurement_workflow.budget_appropriations a ON a.appropriation_id = r.appropriation_id
    WHERE a.budget_code = @p_budget_code
      AND a.department = @p_department
      AND a.fiscal_year = @p_fiscal_year
      AND a.status = 'Active'
),
commitments AS (
    SELECT COALESCE(SUM(c.amount), 0) AS committed
    FROM procurement_workflow.budget_commitments c
    WHERE c.budget_code = @p_budget_code
      AND c.department = @p_department
      AND c.fiscal_year = @p_fiscal_year
      AND c.status IN ('Reserved', 'Committed')
),
expenditures AS (
    SELECT COALESCE(SUM(e.amount), 0) AS spent
    FROM procurement_workflow.budget_expenditures e
    JOIN procurement_workflow.budget_commitments c ON c.commitment_id = e.commitment_id
    WHERE c.budget_code = @p_budget_code
      AND c.department = @p_department
      AND c.fiscal_year = @p_fiscal_year
)
SELECT
    appropriated,
    released,
    committed,
    spent,
    (CASE WHEN released > 0 THEN released ELSE appropriated END) - committed - spent AS available
FROM appropriation, releases, commitments, expenditures;";

        for (var index = 0; index < lines.Count; index += 1)
        {
            var line = lines[index];
            await using var budgetCmd = new NpgsqlCommand(budgetSql, conn);
            budgetCmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, line.BudgetCode);
            budgetCmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, department);
            budgetCmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, fiscalYear);

            await using var budgetReader = await budgetCmd.ExecuteReaderAsync(ct);
            if (!await budgetReader.ReadAsync(ct))
            {
                continue;
            }

            var appropriated = budgetReader.GetDecimal(budgetReader.GetOrdinal("appropriated"));
            var released = budgetReader.GetDecimal(budgetReader.GetOrdinal("released"));
            var committed = budgetReader.GetDecimal(budgetReader.GetOrdinal("committed"));
            var spent = budgetReader.GetDecimal(budgetReader.GetOrdinal("spent"));
            var available = budgetReader.GetDecimal(budgetReader.GetOrdinal("available"));

            lines[index] = line with
            {
                Appropriated = appropriated,
                Released = released,
                Committed = committed,
                Spent = spent,
                Available = available,
                Variance = Math.Max(line.RequestedAmount - available, 0)
            };
        }

        return lines;
    }
}

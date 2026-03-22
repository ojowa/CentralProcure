using eProcurement.Modules.Governance.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Governance.Controllers;

public partial class BudgetLedgerController
{
    [Authorize]
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetBudgetDashboard(
        [FromQuery] int? fiscalYear,
        [FromQuery] string? department,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(department) && department.Trim().Length > MaxDepartmentLength)
        {
            return BadRequest($"Department must be {MaxDepartmentLength} characters or fewer.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string globalSummarySql = @"
WITH appropriation AS (
    SELECT COALESCE(SUM(a.amount), 0) AS amount
    FROM procurement_workflow.budget_appropriations a
    WHERE (@p_fiscal_year IS NULL OR a.fiscal_year = @p_fiscal_year)
      AND (@p_department IS NULL OR a.department = @p_department)
      AND a.status = 'Active'
),
releases AS (
    SELECT COALESCE(SUM(r.amount), 0) AS amount
    FROM procurement_workflow.budget_releases r
    JOIN procurement_workflow.budget_appropriations a ON a.appropriation_id = r.appropriation_id
    WHERE (@p_fiscal_year IS NULL OR a.fiscal_year = @p_fiscal_year)
      AND (@p_department IS NULL OR a.department = @p_department)
      AND a.status = 'Active'
),
commitments AS (
    SELECT COALESCE(SUM(c.amount), 0) AS amount
    FROM procurement_workflow.budget_commitments c
    WHERE (@p_fiscal_year IS NULL OR c.fiscal_year = @p_fiscal_year)
      AND (@p_department IS NULL OR c.department = @p_department)
      AND c.status IN ('Reserved', 'Committed')
),
expenditures AS (
    SELECT COALESCE(SUM(e.amount), 0) AS amount
    FROM procurement_workflow.budget_expenditures e
    JOIN procurement_workflow.budget_commitments c ON c.commitment_id = e.commitment_id
    WHERE (@p_fiscal_year IS NULL OR c.fiscal_year = @p_fiscal_year)
      AND (@p_department IS NULL OR c.department = @p_department)
)
SELECT
    appropriation.amount AS appropriated,
    releases.amount AS released,
    commitments.amount AS committed,
    expenditures.amount AS spent,
    (CASE WHEN releases.amount > 0 THEN releases.amount ELSE appropriation.amount END) - commitments.amount - expenditures.amount AS available
FROM appropriation, releases, commitments, expenditures;";

        const string queueCte = @"
WITH queue AS (
    SELECT
        p.plan_id,
        p.plan_title,
        p.department,
        p.fiscal_year,
        COALESCE(wi.current_stage_key, CASE WHEN p.status = 'Initial' THEN 'budget_code_allocation' ELSE 'department_need_capture' END) AS current_stage_key,
        COALESCE(wi.current_status, p.status) AS workflow_status,
        COALESCE(items.requested_amount, 0) AS requested_amount,
        COALESCE(budget.available, 0) AS available
    FROM procurement_workflow.procurement_plans p
    LEFT JOIN procurement_workflow.workflow_instances wi
        ON wi.entity_type = 'procurement_plan'
       AND wi.entity_id = p.plan_id
    LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(i.estimated_amount), 0) AS requested_amount
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
        app_sub AS (
            SELECT COALESCE(SUM(a.amount), 0) AS amount
            FROM procurement_workflow.budget_appropriations a
            WHERE a.department = p.department
              AND a.fiscal_year = p.fiscal_year
              AND a.status = 'Active'
              AND EXISTS (SELECT 1 FROM codes c WHERE c.budget_code = a.budget_code)
        ),
        rel_sub AS (
            SELECT COALESCE(SUM(r.amount), 0) AS amount
            FROM procurement_workflow.budget_releases r
            JOIN procurement_workflow.budget_appropriations a ON a.appropriation_id = r.appropriation_id
            WHERE a.department = p.department
              AND a.fiscal_year = p.fiscal_year
              AND a.status = 'Active'
              AND EXISTS (SELECT 1 FROM codes c WHERE c.budget_code = a.budget_code)
        ),
        com_sub AS (
            SELECT COALESCE(SUM(c.amount), 0) AS amount
            FROM procurement_workflow.budget_commitments c
            WHERE c.department = p.department
              AND c.fiscal_year = p.fiscal_year
              AND c.status IN ('Reserved', 'Committed')
              AND EXISTS (SELECT 1 FROM codes x WHERE x.budget_code = c.budget_code)
        ),
        exp_sub AS (
            SELECT COALESCE(SUM(e.amount), 0) AS amount
            FROM procurement_workflow.budget_expenditures e
            JOIN procurement_workflow.budget_commitments c ON c.commitment_id = e.commitment_id
            WHERE c.department = p.department
              AND c.fiscal_year = p.fiscal_year
              AND EXISTS (SELECT 1 FROM codes x WHERE x.budget_code = c.budget_code)
        )
        SELECT
            (CASE WHEN rel_sub.amount > 0 THEN rel_sub.amount ELSE app_sub.amount END) - com_sub.amount - exp_sub.amount AS available
        FROM app_sub, rel_sub, com_sub, exp_sub
    ) budget ON TRUE
    WHERE p.status NOT IN ('Approved', 'Cancelled', 'Rejected')
      AND (@p_fiscal_year IS NULL OR p.fiscal_year = @p_fiscal_year)
      AND (@p_department IS NULL OR p.department = @p_department)
)";

        var queueSummarySql = $@"
{queueCte}
SELECT
    COUNT(*)::int AS queue_count,
    COUNT(*) FILTER (WHERE current_stage_key IN ('comptroller_procurement_review', 'planning_committee_review'))::int AS awaiting_budget_review_count,
    COUNT(*) FILTER (WHERE workflow_status = 'On Hold')::int AS on_hold_count,
    COUNT(*) FILTER (WHERE current_stage_key = 'app_approval')::int AS ready_for_approval_count,
    COUNT(*) FILTER (WHERE requested_amount > available)::int AS at_risk_count
FROM queue;";

        var risksSql = $@"
{queueCte}
SELECT
    plan_id,
    plan_title,
    department,
    'Mixed Budget Lines' AS budget_code,
    fiscal_year,
    requested_amount,
    available,
    GREATEST(requested_amount - available, 0) AS variance
FROM queue
WHERE requested_amount > available
ORDER BY variance DESC, plan_title ASC
LIMIT 6;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            // 1. Get Global Summary
            await using var globalCmd = new NpgsqlCommand(globalSummarySql, conn);
            globalCmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)fiscalYear ?? DBNull.Value);
            globalCmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)NormalizeFilter(department) ?? DBNull.Value);

            decimal appropriated = 0, released = 0, committed = 0, spent = 0, available = 0;
            await using (var reader = await globalCmd.ExecuteReaderAsync(ct))
            {
                if (await reader.ReadAsync(ct))
                {
                    appropriated = reader.GetDecimal(reader.GetOrdinal("appropriated"));
                    released = reader.GetDecimal(reader.GetOrdinal("released"));
                    committed = reader.GetDecimal(reader.GetOrdinal("committed"));
                    spent = reader.GetDecimal(reader.GetOrdinal("spent"));
                    available = reader.GetDecimal(reader.GetOrdinal("available"));
                }
            }

            // 2. Get Queue Counts
            await using var queueCmd = new NpgsqlCommand(queueSummarySql, conn);
            queueCmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)fiscalYear ?? DBNull.Value);
            queueCmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)NormalizeFilter(department) ?? DBNull.Value);

            int queueCount = 0, awaiting = 0, onHold = 0, ready = 0, atRisk = 0;
            await using (var reader = await queueCmd.ExecuteReaderAsync(ct))
            {
                if (await reader.ReadAsync(ct))
                {
                    queueCount = reader.GetInt32(reader.GetOrdinal("queue_count"));
                    awaiting = reader.GetInt32(reader.GetOrdinal("awaiting_budget_review_count"));
                    onHold = reader.GetInt32(reader.GetOrdinal("on_hold_count"));
                    ready = reader.GetInt32(reader.GetOrdinal("ready_for_approval_count"));
                    atRisk = reader.GetInt32(reader.GetOrdinal("at_risk_count"));
                }
            }

            var dashboard = new BudgetDashboardResponse(
                appropriated, released, committed, spent, available,
                queueCount, awaiting, onHold, ready, atRisk,
                Array.Empty<BudgetDashboardRiskItem>());

            // 3. Get Risks
            await using var risksCmd = new NpgsqlCommand(risksSql, conn);
            risksCmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)fiscalYear ?? DBNull.Value);
            risksCmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)NormalizeFilter(department) ?? DBNull.Value);

            var risks = new List<BudgetDashboardRiskItem>();
            await using var riskReader = await risksCmd.ExecuteReaderAsync(ct);
            while (await riskReader.ReadAsync(ct))
            {
                risks.Add(new BudgetDashboardRiskItem(
                    riskReader.GetGuid(riskReader.GetOrdinal("plan_id")),
                    riskReader.GetString(riskReader.GetOrdinal("plan_title")),
                    riskReader.GetString(riskReader.GetOrdinal("department")),
                    riskReader.GetString(riskReader.GetOrdinal("budget_code")),
                    riskReader.GetInt32(riskReader.GetOrdinal("fiscal_year")),
                    riskReader.GetDecimal(riskReader.GetOrdinal("requested_amount")),
                    riskReader.GetDecimal(riskReader.GetOrdinal("available")),
                    riskReader.GetDecimal(riskReader.GetOrdinal("variance"))));
            }

            return Ok(dashboard with { TopRisks = risks });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error loading budget officer dashboard.");
            return Problem("Internal server error loading budget officer dashboard.");
        }
    }
}

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

        const string queueCte = @"
WITH queue AS (
    SELECT
        p.plan_id,
        p.plan_title,
        p.department,
        p.fiscal_year,
        COALESCE(wi.current_stage_key, CASE WHEN p.status = 'Submitted' THEN 'planning_committee_review' ELSE 'department_need_capture' END) AS current_stage_key,
        COALESCE(wi.current_status, p.status) AS workflow_status,
        COALESCE(items.requested_amount, 0) AS requested_amount,
        COALESCE(budget.appropriated, 0) AS appropriated,
        COALESCE(budget.released, 0) AS released,
        COALESCE(budget.committed, 0) AS committed,
        COALESCE(budget.spent, 0) AS spent,
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
    WHERE p.status NOT IN ('Approved', 'Cancelled', 'Rejected')
      AND (@p_fiscal_year IS NULL OR p.fiscal_year = @p_fiscal_year)
      AND (@p_department IS NULL OR p.department = @p_department)
)";

        var summarySql = $@"
{queueCte}
SELECT
    COALESCE(SUM(appropriated), 0) AS appropriated,
    COALESCE(SUM(released), 0) AS released,
    COALESCE(SUM(committed), 0) AS committed,
    COALESCE(SUM(spent), 0) AS spent,
    COALESCE(SUM(available), 0) AS available,
    COUNT(*)::int AS queue_count,
    COUNT(*) FILTER (WHERE current_stage_key IN ('planning_committee_review', 'budget_confirmation'))::int AS awaiting_budget_review_count,
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

            await using var summaryCmd = new NpgsqlCommand(summarySql, conn);
            summaryCmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)fiscalYear ?? DBNull.Value);
            summaryCmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)NormalizeFilter(department) ?? DBNull.Value);

            await using var summaryReader = await summaryCmd.ExecuteReaderAsync(ct);
            await summaryReader.ReadAsync(ct);
            var dashboard = new BudgetDashboardResponse(
                summaryReader.GetDecimal(summaryReader.GetOrdinal("appropriated")),
                summaryReader.GetDecimal(summaryReader.GetOrdinal("released")),
                summaryReader.GetDecimal(summaryReader.GetOrdinal("committed")),
                summaryReader.GetDecimal(summaryReader.GetOrdinal("spent")),
                summaryReader.GetDecimal(summaryReader.GetOrdinal("available")),
                summaryReader.GetInt32(summaryReader.GetOrdinal("queue_count")),
                summaryReader.GetInt32(summaryReader.GetOrdinal("awaiting_budget_review_count")),
                summaryReader.GetInt32(summaryReader.GetOrdinal("on_hold_count")),
                summaryReader.GetInt32(summaryReader.GetOrdinal("ready_for_approval_count")),
                summaryReader.GetInt32(summaryReader.GetOrdinal("at_risk_count")),
                Array.Empty<BudgetDashboardRiskItem>());
            await summaryReader.CloseAsync();

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

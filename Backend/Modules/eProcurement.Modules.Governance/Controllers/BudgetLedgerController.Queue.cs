using System.Data;
using eProcurement.Modules.Governance.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Governance.Controllers;

public partial class BudgetLedgerController
{
    [Authorize]
    [HttpGet("confirmations")]
    public async Task<IActionResult> GetBudgetConfirmations(
        [FromQuery] int? fiscalYear,
        [FromQuery] string? department,
        [FromQuery] string? stage,
        [FromQuery] string? query,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(department) && department.Trim().Length > MaxDepartmentLength)
        {
            return BadRequest($"Department must be {MaxDepartmentLength} characters or fewer.");
        }

        if (page < 1)
        {
            return BadRequest("Page must be 1 or greater.");
        }

        if (pageSize < 1 || pageSize > MaxPageSize)
        {
            return BadRequest($"PageSize must be between 1 and {MaxPageSize}.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        var baseSql = @"
WITH queue AS (
    SELECT
        p.plan_id,
        p.plan_title,
        p.department,
        p.fiscal_year,
        p.status AS plan_status,
        p.total_budget,
        COALESCE(items.requested_amount, 0) AS requested_amount,
        COALESCE(items.item_count, 0) AS item_count,
        COALESCE(wi.current_stage_key, CASE WHEN p.status = 'Initial' THEN 'budget_code_allocation' ELSE 'department_need_capture' END) AS current_stage_key,
        COALESCE(sc.stage_title, CASE WHEN p.status = 'Initial' THEN 'Budget Code Allocation' ELSE 'Department Need Capture' END) AS current_stage_title,
        COALESCE(wi.current_status, p.status) AS workflow_status,
        p.created_at,
        p.updated_at,
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
    WHERE p.status NOT IN ('Approved', 'Cancelled', 'Rejected')
)
SELECT
    q.*,
    GREATEST(q.requested_amount - q.available, 0) AS variance
FROM queue q
WHERE q.current_stage_key IN ('comptroller_procurement_review', 'planning_committee_review', 'budget_confirmation', 'app_approval')
  AND (@p_fiscal_year IS NULL OR q.fiscal_year = @p_fiscal_year)
  AND (@p_department IS NULL OR q.department = @p_department)
  AND (@p_stage IS NULL OR q.current_stage_key = @p_stage)
  AND (
        @p_query IS NULL
        OR q.plan_title ILIKE '%' || @p_query || '%'
        OR q.department ILIKE '%' || @p_query || '%'
        OR EXISTS (
            SELECT 1
            FROM procurement_workflow.procurement_plan_items i
            WHERE i.plan_id = q.plan_id
              AND (
                  i.description ILIKE '%' || @p_query || '%'
                  OR i.budget_code ILIKE '%' || @p_query || '%'
              )
        )
  )";

        var countSql = $"SELECT COUNT(*) FROM ({baseSql}) q;";
        var itemSql = $"{baseSql} ORDER BY variance DESC, q.updated_at DESC OFFSET @p_offset LIMIT @p_limit;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var countCmd = new NpgsqlCommand(countSql, conn);
            AddQueueFilters(countCmd, fiscalYear, department, stage, query);
            var total = Convert.ToInt64(await countCmd.ExecuteScalarAsync(ct) ?? 0);

            await using var itemCmd = new NpgsqlCommand(itemSql, conn);
            AddQueueFilters(itemCmd, fiscalYear, department, stage, query);
            itemCmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, (page - 1) * pageSize);
            itemCmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, pageSize);

            var items = new List<BudgetConfirmationQueueItem>();
            await using var reader = await itemCmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                items.Add(MapBudgetConfirmationQueueItem(reader));
            }

            return Ok(new BudgetConfirmationListResponse(items, page, pageSize, total));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error loading budget confirmation queue.");
            return Problem("Internal server error loading budget confirmation queue.");
        }
    }

    private static string? NormalizeFilter(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static void AddQueueFilters(
        NpgsqlCommand cmd,
        int? fiscalYear,
        string? department,
        string? stage,
        string? query)
    {
        cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)fiscalYear ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)NormalizeFilter(department) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_stage", NpgsqlDbType.Varchar, (object?)NormalizeFilter(stage) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)NormalizeFilter(query) ?? DBNull.Value);
    }

    private static BudgetConfirmationQueueItem MapBudgetConfirmationQueueItem(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("plan_id")),
            reader.GetString(reader.GetOrdinal("plan_title")),
            reader.GetString(reader.GetOrdinal("department")),
            reader.GetInt32(reader.GetOrdinal("fiscal_year")),
            reader.GetString(reader.GetOrdinal("plan_status")),
            reader.GetString(reader.GetOrdinal("current_stage_key")),
            reader.GetString(reader.GetOrdinal("current_stage_title")),
            GetNullableString(reader, "workflow_status"),
            reader.GetDecimal(reader.GetOrdinal("total_budget")),
            reader.GetDecimal(reader.GetOrdinal("requested_amount")),
            reader.GetDecimal(reader.GetOrdinal("appropriated")),
            reader.GetDecimal(reader.GetOrdinal("released")),
            reader.GetDecimal(reader.GetOrdinal("committed")),
            reader.GetDecimal(reader.GetOrdinal("spent")),
            reader.GetDecimal(reader.GetOrdinal("available")),
            reader.GetDecimal(reader.GetOrdinal("variance")),
            reader.GetInt32(reader.GetOrdinal("item_count")),
            reader.GetDateTime(reader.GetOrdinal("created_at")),
            reader.GetDateTime(reader.GetOrdinal("updated_at")));
}

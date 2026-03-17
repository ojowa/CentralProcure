using System.Data;
using System.Security.Claims;
using eProcurement.Modules.Governance.DTOs;
using eProcurement.Shared.Controllers;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Governance.Controllers;

[ApiController]
[Route("api/budget")]
public class BudgetLedgerController : BaseModuleController
{
    private const int MaxDepartmentLength = 150;
    private const int MaxBudgetCodeLength = 60;
    private const int DefaultPageSize = 12;
    private const int MaxPageSize = 100;

    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

    public BudgetLedgerController(
        IConfiguration config,
        ILogger<BudgetLedgerController> logger,
        WorkflowRuntimeTracker workflowRuntimeTracker)
        : base(config, logger)
    {
        _workflowRuntimeTracker = workflowRuntimeTracker;
    }

    [HttpGet("availability")]
    public async Task<IActionResult> GetAvailability(
        [FromQuery] string budgetCode,
        [FromQuery] string department,
        [FromQuery] int fiscalYear,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(budgetCode))
        {
            return BadRequest("BudgetCode is required.");
        }

        if (string.IsNullOrWhiteSpace(department))
        {
            return BadRequest("Department is required.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = "SELECT procurement_workflow.get_budget_available(@p_budget_code, @p_department, @p_fiscal_year);";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, budgetCode);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, department);
            cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, fiscalYear);

            var result = await cmd.ExecuteScalarAsync(ct);
            var available = result is null ? 0 : Convert.ToDecimal(result);
            return Ok(new BudgetAvailabilityResponse(available));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error getting budget availability for {BudgetCode}.", budgetCode);
            return Problem("Internal server error retrieving budget availability.");
        }
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        [FromQuery] string budgetCode,
        [FromQuery] string department,
        [FromQuery] int fiscalYear,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(budgetCode))
        {
            return BadRequest("BudgetCode is required.");
        }

        if (string.IsNullOrWhiteSpace(department))
        {
            return BadRequest("Department is required.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
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

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, budgetCode);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, department);
            cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, fiscalYear);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return NotFound();
            }

            return Ok(new BudgetSummaryResponse(
                reader.GetDecimal(0),
                reader.GetDecimal(1),
                reader.GetDecimal(2),
                reader.GetDecimal(3),
                reader.GetDecimal(4)));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error getting budget summary for {BudgetCode}.", budgetCode);
            return Problem("Internal server error retrieving budget summary.");
        }
    }

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
        COALESCE(wi.current_stage_key, CASE WHEN p.status = 'Submitted' THEN 'planning_committee_review' ELSE 'department_need_capture' END) AS current_stage_key,
        COALESCE(sc.stage_title, CASE WHEN p.status = 'Submitted' THEN 'Planning Committee Review' ELSE 'Department Need Capture' END) AS current_stage_title,
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
WHERE q.current_stage_key IN ('planning_committee_review', 'budget_confirmation', 'app_approval')
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
    COALESCE(wi.current_stage_key, CASE WHEN p.status = 'Submitted' THEN 'planning_committee_review' ELSE 'department_need_capture' END) AS current_stage_key,
    COALESCE(sc.stage_title, CASE WHEN p.status = 'Submitted' THEN 'Planning Committee Review' ELSE 'Department Need Capture' END) AS current_stage_title,
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
            Logger.LogError(ex, "Error loading budget confirmation detail for plan {PlanId}.", planId);
            return Problem("Internal server error loading budget confirmation detail.");
        }
    }

    [Authorize]
    [HttpPost("confirmations/{planId:guid}/decision")]
    public async Task<IActionResult> DecideBudgetConfirmation(Guid planId, [FromBody] BudgetDecisionRequest request, CancellationToken ct)
    {
        if (!CanActAsBudgetOfficer())
        {
            return Forbid();
        }

        var normalizedDecision = NormalizeFilter(request.Decision)?.ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedDecision))
        {
            return BadRequest("Decision is required.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var plan = await GetPlanDecisionContextAsync(conn, tx, planId, ct);
            if (plan is null)
            {
                return NotFound();
            }

            var actor = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name;
            var noteEntry = BuildDecisionNote(normalizedDecision, request.Note, actor);
            var target = ResolveDecisionTarget(normalizedDecision, plan);

            await AppendDecisionNoteAsync(conn, tx, planId, noteEntry, target.PlanStatus, ct);
            await _workflowRuntimeTracker.SyncAsync(
                conn,
                tx,
                new WorkflowRuntimeSyncRequest(
                    "procurement_plan",
                    planId,
                    target.StageKey,
                    target.WorkflowStatus,
                    plan.PlanTitle,
                    null,
                    null,
                    plan.TotalBudget,
                    null,
                    null,
                    noteEntry,
                    actor,
                    "budget_officer_decision"),
                ct);

            await tx.CommitAsync(ct);

            return Ok(new BudgetDecisionResponse(
                planId,
                normalizedDecision,
                target.Message,
                target.StageKey,
                target.StageTitle,
                target.WorkflowStatus,
                target.PlanStatus));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error applying budget decision for plan {PlanId}.", planId);
            return Problem("Internal server error applying budget decision.");
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

    private static async Task<PlanDecisionContext?> GetPlanDecisionContextAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid planId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT
    p.plan_id,
    p.plan_title,
    p.status AS plan_status,
    p.total_budget,
    COALESCE(wi.current_stage_key, CASE WHEN p.status = 'Submitted' THEN 'planning_committee_review' ELSE 'department_need_capture' END) AS current_stage_key,
    COALESCE(sc.stage_title, CASE WHEN p.status = 'Submitted' THEN 'Planning Committee Review' ELSE 'Department Need Capture' END) AS current_stage_title
FROM procurement_workflow.procurement_plans p
LEFT JOIN procurement_workflow.workflow_instances wi
    ON wi.entity_type = 'procurement_plan'
   AND wi.entity_id = p.plan_id
LEFT JOIN procurement_workflow.workflow_stage_catalog sc
    ON sc.stage_key = wi.current_stage_key
WHERE p.plan_id = @p_plan_id
FOR UPDATE;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new PlanDecisionContext(
            reader.GetGuid(reader.GetOrdinal("plan_id")),
            reader.GetString(reader.GetOrdinal("plan_title")),
            reader.GetString(reader.GetOrdinal("plan_status")),
            reader.GetString(reader.GetOrdinal("current_stage_key")),
            reader.GetString(reader.GetOrdinal("current_stage_title")),
            reader.GetDecimal(reader.GetOrdinal("total_budget")));
    }

    private static string BuildDecisionNote(string decision, string? note, string? actor)
    {
        var decisionLabel = decision.Replace('_', ' ');
        var stamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss 'UTC'");
        var actorLabel = string.IsNullOrWhiteSpace(actor) ? "system" : actor.Trim();
        var message = string.IsNullOrWhiteSpace(note) ? "No note supplied." : note.Trim();
        return $"[{stamp}] Budget officer {decisionLabel}: {message} (actor: {actorLabel})";
    }

    private static DecisionTarget ResolveDecisionTarget(string decision, PlanDecisionContext plan)
    {
        var currentStageKey = plan.CurrentStageKey;
        var currentStageTitle = plan.CurrentStageTitle;
        var currentPlanStatus = plan.CurrentPlanStatus;

        return decision switch
        {
            "start_review" when string.Equals(currentStageKey, "planning_committee_review", StringComparison.OrdinalIgnoreCase)
                => new DecisionTarget("budget_confirmation", "Budget Confirmation", "Under Review", "Submitted", "Budget review started."),
            "confirm" when string.Equals(currentStageKey, "planning_committee_review", StringComparison.OrdinalIgnoreCase)
                || string.Equals(currentStageKey, "budget_confirmation", StringComparison.OrdinalIgnoreCase)
                => new DecisionTarget("app_approval", "APP Approval", "Budget Confirmed", "Submitted", "Funding confirmed and routed for APP approval."),
            "hold"
                => new DecisionTarget(currentStageKey, currentStageTitle, "On Hold", currentPlanStatus, "Plan placed on hold for budget clarification."),
            "return"
                => new DecisionTarget("planning_committee_review", "Planning Committee Review", "Returned", "Draft", "Plan returned for planning correction."),
            "reject"
                => new DecisionTarget(currentStageKey, currentStageTitle, "Rejected", "Rejected", "Plan rejected at budget review."),
            _ => throw new InvalidOperationException("Decision must be one of: start_review, confirm, hold, return, reject.")
        };
    }

    private static async Task AppendDecisionNoteAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid planId,
        string noteEntry,
        string planStatus,
        CancellationToken ct)
    {
        const string sql = @"
UPDATE procurement_workflow.procurement_plans
SET
    status = @p_status,
    notes = CASE
        WHEN NULLIF(BTRIM(notes), '') IS NULL THEN @p_note
        ELSE notes || E'\n\n' || @p_note
    END,
    updated_at = NOW()
WHERE plan_id = @p_plan_id;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, planStatus);
        cmd.Parameters.AddWithValue("p_note", NpgsqlDbType.Text, noteEntry);

        var affected = await cmd.ExecuteNonQueryAsync(ct);
        if (affected == 0)
        {
            throw new InvalidOperationException("Procurement plan could not be updated.");
        }
    }

    private bool CanActAsBudgetOfficer()
    {
        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        return string.Equals(roleKey, "financial_unit_officer", StringComparison.OrdinalIgnoreCase)
            || string.Equals(roleKey, "accounting_officer", StringComparison.OrdinalIgnoreCase)
            || string.Equals(roleKey, "admin", StringComparison.OrdinalIgnoreCase);
    }

    private sealed record PlanDecisionContext(
        Guid PlanId,
        string PlanTitle,
        string CurrentPlanStatus,
        string CurrentStageKey,
        string CurrentStageTitle,
        decimal TotalBudget);

    private sealed record DecisionTarget(
        string StageKey,
        string StageTitle,
        string WorkflowStatus,
        string PlanStatus,
        string Message);
}

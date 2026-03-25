using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class ProcurementPlansController
{
    [HttpGet]
    public async Task<IActionResult> GetPlans(
        [FromQuery] int? fiscalYear,
        [FromQuery] string? department,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        [FromQuery] string? sortBy = "created_at",
        [FromQuery] string? sortDir = "desc",
        CancellationToken ct = default)
    {
        if (fiscalYear.HasValue && (fiscalYear.Value < MinFiscalYear || fiscalYear.Value > MaxFiscalYear))
            return BadRequest($"FiscalYear must be between {MinFiscalYear} and {MaxFiscalYear}.");
        if (!string.IsNullOrWhiteSpace(department) && department.Trim().Length > MaxDepartmentLength)
            return BadRequest($"Department must be {MaxDepartmentLength} characters or fewer.");
        if (!IsStatusValid(status, out _))
            return BadRequest($"Status must be one of: {string.Join(", ", AllowedStatuses)}.");
        if (page < 1)
            return BadRequest("Page must be 1 or greater.");
        if (pageSize < 1 || pageSize > MaxPageSize)
            return BadRequest($"PageSize must be between 1 and {MaxPageSize}.");

        sortBy = string.IsNullOrWhiteSpace(sortBy) ? "created_at" : sortBy.Trim().ToLowerInvariant();
        sortDir = string.IsNullOrWhiteSpace(sortDir) ? "desc" : sortDir.Trim().ToLowerInvariant();
        if (!AllowedSortFields.Contains(sortBy))
            return BadRequest($"SortBy must be one of: {string.Join(", ", AllowedSortFields)}.");
        if (!AllowedSortDirections.Contains(sortDir))
            return BadRequest("SortDir must be 'asc' or 'desc'.");

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            var total = await GetPlanCountAsync(conn, tx, fiscalYear, department, status, ct);
            var results = await GetCommitteeCreatedPlansAsync(conn, tx, fiscalYear, department, status, pageSize, (page - 1) * pageSize, sortBy, sortDir, ct);
            await tx.CommitAsync(ct);
            return Ok(new { Items = results, Page = page, PageSize = pageSize, Total = total });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving procurement plans.");
            return Problem("Internal server error retrieving procurement plans.");
        }
    }

    [HttpGet("{planId:guid}")]
    public async Task<IActionResult> GetPlan(Guid planId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            var plan = await GetPlanDetailAsync(conn, tx, planId, ct);
            if (plan is null)
                return NotFound();

            var items = await GetPlanItemsAsync(conn, tx, planId, ct);
            await tx.CommitAsync(ct);
            return Ok(new { Plan = plan, Items = items });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving procurement plan {PlanId}.", planId);
            return Problem("Internal server error retrieving procurement plan.");
        }
    }

    private static async Task<long> GetPlanCountAsync(NpgsqlConnection conn, NpgsqlTransaction tx, int? fiscalYear, string? department, string? status, CancellationToken ct)
    {
        const string sql = """
SELECT COUNT(*)
FROM procurement_workflow.procurement_plans p
WHERE
    (EXISTS (SELECT 1 FROM procurement_workflow.planning_committee_plan_links l WHERE l.plan_id = p.plan_id)
     OR EXISTS (SELECT 1 FROM procurement_workflow.planning_committee_decisions d WHERE d.plan_id = p.plan_id))
    AND (@p_fiscal_year IS NULL OR p.fiscal_year = @p_fiscal_year)
    AND (@p_department IS NULL OR p.department ILIKE '%' || @p_department || '%')
    AND (@p_status IS NULL OR p.status ILIKE @p_status);
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)fiscalYear ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)department ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is null ? 0 : Convert.ToInt64(result);
    }

    private static async Task<List<ProcurementPlanSummary>> GetCommitteeCreatedPlansAsync(
        NpgsqlConnection conn, NpgsqlTransaction tx, int? fiscalYear, string? department, string? status,
        int limit, int offset, string sortBy, string sortDir, CancellationToken ct)
    {
        const string sql = """
SELECT p.plan_id, p.plan_title, p.department, p.fiscal_year, p.status,
       wi.current_stage_key, sc.stage_title AS current_stage_title,
       CASE WHEN calc.item_count > 0 THEN calc.calculated_total_budget ELSE p.total_budget END AS total_budget,
       p.created_at,
       y.yearly_app_id, y.title AS yearly_app_title
FROM procurement_workflow.procurement_plans p
LEFT JOIN procurement_workflow.yearly_apps y ON y.yearly_app_id = p.yearly_app_id
LEFT JOIN procurement_workflow.workflow_instances wi ON wi.entity_type = 'procurement_plan' AND wi.entity_id = p.plan_id
LEFT JOIN procurement_workflow.workflow_stage_catalog sc ON sc.stage_key = wi.current_stage_key
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
WHERE
    (EXISTS (SELECT 1 FROM procurement_workflow.planning_committee_plan_links l WHERE l.plan_id = p.plan_id)
     OR EXISTS (SELECT 1 FROM procurement_workflow.planning_committee_decisions d WHERE d.plan_id = p.plan_id))
    AND (@p_fiscal_year IS NULL OR p.fiscal_year = @p_fiscal_year)
    AND (@p_department IS NULL OR p.department ILIKE '%' || @p_department || '%')
    AND (@p_status IS NULL OR p.status ILIKE @p_status)
ORDER BY
    CASE WHEN lower(@p_sort_by) = 'plan_title' AND lower(@p_sort_dir) = 'asc' THEN p.plan_title END ASC,
    CASE WHEN lower(@p_sort_by) = 'plan_title' AND lower(@p_sort_dir) = 'desc' THEN p.plan_title END DESC,
    CASE WHEN lower(@p_sort_by) = 'department' AND lower(@p_sort_dir) = 'asc' THEN p.department END ASC,
    CASE WHEN lower(@p_sort_by) = 'department' AND lower(@p_sort_dir) = 'desc' THEN p.department END DESC,
    CASE WHEN lower(@p_sort_by) = 'fiscal_year' AND lower(@p_sort_dir) = 'asc' THEN p.fiscal_year END ASC,
    CASE WHEN lower(@p_sort_by) = 'fiscal_year' AND lower(@p_sort_dir) = 'desc' THEN p.fiscal_year END DESC,
    CASE WHEN lower(@p_sort_by) = 'status' AND lower(@p_sort_dir) = 'asc' THEN p.status END ASC,
    CASE WHEN lower(@p_sort_by) = 'status' AND lower(@p_sort_dir) = 'desc' THEN p.status END DESC,
    CASE WHEN lower(@p_sort_by) = 'total_budget' AND lower(@p_sort_dir) = 'asc' THEN CASE WHEN calc.item_count > 0 THEN calc.calculated_total_budget ELSE p.total_budget END END ASC,
    CASE WHEN lower(@p_sort_by) = 'total_budget' AND lower(@p_sort_dir) = 'desc' THEN CASE WHEN calc.item_count > 0 THEN calc.calculated_total_budget ELSE p.total_budget END END DESC,
    CASE WHEN lower(@p_sort_by) = 'created_at' AND lower(@p_sort_dir) = 'asc' THEN p.created_at END ASC,
    CASE WHEN lower(@p_sort_by) = 'created_at' AND lower(@p_sort_dir) = 'desc' THEN p.created_at END DESC,
    p.created_at DESC
LIMIT @p_limit OFFSET @p_offset;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)fiscalYear ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)department ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_sort_by", NpgsqlDbType.Varchar, sortBy);
        cmd.Parameters.AddWithValue("p_sort_dir", NpgsqlDbType.Varchar, sortDir);
        cmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, limit);
        cmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, offset);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<ProcurementPlanSummary>();
        while (await reader.ReadAsync(ct))
            results.Add(MapPlanSummary(reader));
        return results;
    }
}

using System;
using System.Collections.Generic;
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
    [HttpGet("requisitions")]
    public async Task<IActionResult> GetBudgetRequisitions(
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

        var stageFilter = string.IsNullOrWhiteSpace(stage) ? "budget_code_allocation" : stage.Trim();
        var stageStatuses = GetStageStatuses(stageFilter);
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        var baseSql = @"
WITH queue AS (
    SELECT
        r.requisition_id,
        r.title,
        r.department,
        NULLIF(BTRIM(r.budget_code), '') AS budget_code,
        r.app_item_id,
        r.total_estimate,
        r.required_by,
        r.status,
        COALESCE(wi.current_stage_key, r.current_stage, 'procurement_initiation') AS current_stage_key,
        COALESCE(sc.stage_title, r.current_stage, 'Procurement') AS current_stage_title,
        COALESCE(wi.current_status, r.status) AS workflow_status,
        r.created_at,
        r.updated_at,
        COALESCE(
            CASE WHEN NULLIF(BTRIM(r.budget_code), '') IS NOT NULL THEN
                procurement_workflow.get_budget_available(
                    NULLIF(BTRIM(r.budget_code), ''),
                    r.department,
                    COALESCE(EXTRACT(YEAR FROM r.required_by)::INT, EXTRACT(YEAR FROM r.created_at)::INT, EXTRACT(YEAR FROM NOW())::INT)
                )
            ELSE 0 END,
            0
        ) AS available,
        COALESCE(
            (
                SELECT COALESCE(SUM(c.amount), 0)
                FROM procurement_workflow.budget_commitments c
                WHERE c.requisition_id = r.requisition_id
                  AND c.status IN ('Reserved', 'Committed')
            ),
            0
        ) AS committed,
        COALESCE(EXTRACT(YEAR FROM r.required_by)::INT, EXTRACT(YEAR FROM r.created_at)::INT, EXTRACT(YEAR FROM NOW())::INT) AS fiscal_year
    FROM procurement_workflow.requisitions r
    LEFT JOIN procurement_workflow.workflow_instances wi
        ON wi.entity_type = 'requisition'
       AND wi.entity_id = r.requisition_id
    LEFT JOIN procurement_workflow.workflow_stage_catalog sc
        ON sc.stage_key = COALESCE(wi.current_stage_key, r.current_stage)
    WHERE r.status NOT IN ('Cancelled', 'Rejected')
)
SELECT
    q.*,
    q.total_estimate - q.available AS variance
FROM queue q
 WHERE q.status = ANY(@p_statuses)
   AND (@p_fiscal_year IS NULL OR q.fiscal_year = @p_fiscal_year)
  AND (@p_department IS NULL OR q.department = @p_department)
  AND (
        @p_query IS NULL
        OR q.title ILIKE '%' || @p_query || '%'
        OR q.department ILIKE '%' || @p_query || '%'
        OR q.budget_code ILIKE '%' || @p_query || '%'
  )
";

        var filteredSql = $"{baseSql} ORDER BY q.updated_at DESC";
        var countSql = $"SELECT COUNT(*) FROM ({baseSql}) q";
        var itemSql = $"{filteredSql} OFFSET @p_offset LIMIT @p_limit";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var countCmd = new NpgsqlCommand(countSql, conn);
            AddRequisitionQueueFilters(countCmd, fiscalYear, department, stageStatuses, query);
            var total = Convert.ToInt64(await countCmd.ExecuteScalarAsync(ct) ?? 0);

            await using var itemCmd = new NpgsqlCommand(itemSql, conn);
            AddRequisitionQueueFilters(itemCmd, fiscalYear, department, stageStatuses, query);
            itemCmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, (page - 1) * pageSize);
            itemCmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, pageSize);

            var items = new List<BudgetRequisitionQueueItem>();
            await using var reader = await itemCmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                items.Add(MapBudgetRequisitionQueueItem(reader));
            }

            return Ok(new BudgetRequisitionListResponse(items, page, pageSize, total));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error loading requisition budget queue.");
            return Problem("Internal server error loading requisition budget queue.");
        }
    }

    private static void AddRequisitionQueueFilters(
        NpgsqlCommand cmd,
        int? fiscalYear,
        string? department,
        string[] stageStatuses,
        string? query)
    {
        cmd.Parameters.AddWithValue("p_statuses", NpgsqlDbType.Array | NpgsqlDbType.Varchar, stageStatuses);
        cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)fiscalYear ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)NormalizeFilter(department) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)NormalizeFilter(query) ?? DBNull.Value);
    }

    private static readonly string[] AllBudgetStageStatuses =
        { "Endorsed", "Initial", "Under Review", "Evaluation", "Board Review", "Approved" };

    private static readonly Dictionary<string, string[]> StageStatusLookup = new(StringComparer.OrdinalIgnoreCase)
    {
        ["budget_alignment"] = new[] { "Endorsed", "Initial", "Under Review" },
        ["budget_code_allocation"] = new[] { "Endorsed", "Initial" },
        ["comptroller_procurement_review"] = new[] { "Endorsed", "Initial" },
        ["planning_committee_review"] = new[] { "Evaluation", "Board Review" },
        ["app_approval"] = new[] { "Approved" }
    };

    private static string[] GetStageStatuses(string stageKey)
        => StageStatusLookup.TryGetValue(stageKey, out var statuses)
            ? statuses
            : AllBudgetStageStatuses;

    private static BudgetRequisitionQueueItem MapBudgetRequisitionQueueItem(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("requisition_id")),
            reader.GetString(reader.GetOrdinal("title")),
            reader.GetString(reader.GetOrdinal("department")),
            GetNullableString(reader, "budget_code"),
            GetNullableGuid(reader, "app_item_id"),
            reader.GetDecimal(reader.GetOrdinal("total_estimate")),
            GetNullableDateTime(reader, "required_by"),
            reader.GetString(reader.GetOrdinal("status")),
            reader.GetString(reader.GetOrdinal("current_stage_key")),
            reader.GetString(reader.GetOrdinal("current_stage_title")),
            GetNullableString(reader, "workflow_status"),
            reader.GetDecimal(reader.GetOrdinal("available")),
            reader.GetDecimal(reader.GetOrdinal("committed")),
            reader.GetDecimal(reader.GetOrdinal("variance")),
            reader.GetDateTime(reader.GetOrdinal("created_at")),
            reader.GetDateTime(reader.GetOrdinal("updated_at")));
}

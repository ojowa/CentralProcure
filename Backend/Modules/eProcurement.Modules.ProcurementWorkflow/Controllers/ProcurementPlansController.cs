using System.Data;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/procurement-plans")]
public class ProcurementPlansController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<ProcurementPlansController> _logger;
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

    private static readonly string[] AllowedStatuses = { "Draft", "Submitted", "Under Review", "Approved", "Rejected", "Cancelled" };
    private const int MinTitleLength = 5;
    private const int MaxTitleLength = 255;
    private const int MinDepartmentLength = 3;
    private const int MaxDepartmentLength = 150;
    private const int MinFiscalYear = 2000;
    private const int MaxFiscalYear = 2100;
    private const decimal MaxTotalBudget = 10000000000m;
    private const int DefaultPageSize = 10;
    private const int MaxPageSize = 100;
    private static readonly HashSet<string> AllowedSortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "plan_title",
        "department",
        "fiscal_year",
        "status",
        "total_budget",
        "created_at"
    };
    private static readonly HashSet<string> AllowedSortDirections = new(StringComparer.OrdinalIgnoreCase) { "asc", "desc" };

    public ProcurementPlansController(
        IConfiguration config,
        ILogger<ProcurementPlansController> logger,
        WorkflowPolicyGuard workflowPolicyGuard,
        WorkflowRuntimeTracker workflowRuntimeTracker)
    {
        _config = config;
        _logger = logger;
        _workflowPolicyGuard = workflowPolicyGuard;
        _workflowRuntimeTracker = workflowRuntimeTracker;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

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
        {
            return BadRequest($"FiscalYear must be between {MinFiscalYear} and {MaxFiscalYear}.");
        }

        if (!string.IsNullOrWhiteSpace(department) && department.Trim().Length > MaxDepartmentLength)
        {
            return BadRequest($"Department must be {MaxDepartmentLength} characters or fewer.");
        }

        if (!IsStatusValid(status, out _))
        {
            return BadRequest($"Status must be one of: {string.Join(", ", AllowedStatuses)}.");
        }

        if (page < 1)
        {
            return BadRequest("Page must be 1 or greater.");
        }

        if (pageSize < 1 || pageSize > MaxPageSize)
        {
            return BadRequest($"PageSize must be between 1 and {MaxPageSize}.");
        }

        sortBy = string.IsNullOrWhiteSpace(sortBy) ? "created_at" : sortBy.Trim().ToLowerInvariant();
        sortDir = string.IsNullOrWhiteSpace(sortDir) ? "desc" : sortDir.Trim().ToLowerInvariant();

        if (!AllowedSortFields.Contains(sortBy))
        {
            return BadRequest($"SortBy must be one of: {string.Join(", ", AllowedSortFields)}.");
        }

        if (!AllowedSortDirections.Contains(sortDir))
        {
            return BadRequest("SortDir must be 'asc' or 'desc'.");
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

            var total = await GetPlanCountAsync(conn, tx, fiscalYear, department, status, ct);

            await using var cmd = new NpgsqlCommand("procurement_workflow.get_procurement_plans_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)fiscalYear ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)department ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_sort_by", NpgsqlDbType.Varchar, sortBy);
            cmd.Parameters.AddWithValue("p_sort_dir", NpgsqlDbType.Varchar, sortDir);
            cmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, pageSize);
            cmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, (page - 1) * pageSize);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapPlanSummary, ct);
            await tx.CommitAsync(ct);

            return Ok(new
            {
                Items = results,
                Page = page,
                PageSize = pageSize,
                Total = total
            });
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
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var plan = await GetPlanDetailAsync(conn, tx, planId, ct);
            if (plan is null)
            {
                return NotFound();
            }

            var items = await GetPlanItemsAsync(conn, tx, planId, ct);
            await tx.CommitAsync(ct);

            return Ok(new
            {
                Plan = plan,
                Items = items
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving procurement plan {PlanId}.", planId);
            return Problem("Internal server error retrieving procurement plan.");
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreatePlan([FromBody] ProcurementPlanCreateRequest request, CancellationToken ct)
    {
        var validationError = ValidateCreateRequest(request, out var normalizedStatus);
        if (validationError is not null)
        {
            return BadRequest(validationError);
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
            await using var cmd = new NpgsqlCommand("procurement_workflow.create_procurement_plan_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_plan_title", NpgsqlDbType.Varchar, request.PlanTitle);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, request.Department);
            cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, request.FiscalYear);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_total_budget", NpgsqlDbType.Numeric, request.TotalBudget);
            cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)request.Notes ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapPlanDetail, ct);
            var result = results.FirstOrDefault();
            if (result is null)
            {
                return Problem("Procurement plan creation failed.");
            }

            await SyncWorkflowRuntimeAsync(conn, tx, result, "Procurement plan created.", ct);
            await tx.CommitAsync(ct);
            return Created($"/api/procurement-plans/{result.PlanId}", result);
        }
        catch (PostgresException ex)
        {
            _logger.LogError(ex, "Error creating procurement plan.");
            return BadRequest(ex.MessageText);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating procurement plan.");
            return Problem("Internal server error creating procurement plan.");
        }
    }

    [HttpPut("{planId:guid}")]
    public async Task<IActionResult> UpdatePlan(Guid planId, [FromBody] ProcurementPlanUpdateRequest request, CancellationToken ct)
    {
        if (request is null)
        {
            return BadRequest("Request body is required.");
        }

        var validationError = ValidateUpdateRequest(request, out var normalizedStatus);
        if (validationError is not null)
        {
            return BadRequest(validationError);
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

            if (!string.IsNullOrWhiteSpace(normalizedStatus))
            {
                var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(
                    conn,
                    tx,
                    "procurement_plan",
                    planId,
                    ResolveWorkflowStage(normalizedStatus),
                    ct);

                if (!transition.IsAllowed)
                {
                    return BadRequest(transition.Message);
                }
            }

            await using var cmd = new NpgsqlCommand("procurement_workflow.update_procurement_plan_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
            cmd.Parameters.AddWithValue("p_plan_title", NpgsqlDbType.Varchar, (object?)request.PlanTitle ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)request.Department ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)request.FiscalYear ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_total_budget", NpgsqlDbType.Numeric, (object?)request.TotalBudget ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)request.Notes ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_submitted_at", NpgsqlDbType.Timestamp, (object?)request.SubmittedAt ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_approved_at", NpgsqlDbType.Timestamp, (object?)request.ApprovedAt ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapPlanDetail, ct);
            var result = results.FirstOrDefault();
            if (result is null)
            {
                return NotFound();
            }

            await SyncWorkflowRuntimeAsync(conn, tx, result, "Procurement plan updated.", ct);
            await tx.CommitAsync(ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating procurement plan {PlanId}.", planId);
            return Problem("Internal server error updating procurement plan.");
        }
    }

    [HttpDelete("{planId:guid}")]
    public async Task<IActionResult> DeletePlan(Guid planId, CancellationToken ct)
    {
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
            await using var cmd = new NpgsqlCommand("procurement_workflow.delete_procurement_plan_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapPlanDetail, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            return result is null ? NotFound() : Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting procurement plan {PlanId}.", planId);
            return Problem("Internal server error deleting procurement plan.");
        }
    }

    private static async Task<List<T>> ExecuteRefcursorAsync<T>(NpgsqlCommand cmd, Func<NpgsqlDataReader, T> map, CancellationToken ct)
    {
        await cmd.ExecuteNonQueryAsync(ct);
        var cursorName = (string)cmd.Parameters["p_result"].Value!;
        await using var fetch = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", cmd.Connection!, cmd.Transaction);
        await using var reader = await fetch.ExecuteReaderAsync(ct);

        var results = new List<T>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(map(reader));
        }

        return results;
    }

    private static ProcurementPlanSummary MapPlanSummary(NpgsqlDataReader r)
    {
        return new ProcurementPlanSummary(
            r.GetGuid(r.GetOrdinal("plan_id")),
            r.GetString(r.GetOrdinal("plan_title")),
            r.GetString(r.GetOrdinal("department")),
            r.GetInt32(r.GetOrdinal("fiscal_year")),
            r.GetString(r.GetOrdinal("status")),
            r.GetFieldValue<decimal>(r.GetOrdinal("total_budget")),
            r.GetDateTime(r.GetOrdinal("created_at")));
    }

    private static ProcurementPlanDetail MapPlanDetail(NpgsqlDataReader r)
    {
        return new ProcurementPlanDetail(
            r.GetGuid(r.GetOrdinal("plan_id")),
            r.GetString(r.GetOrdinal("plan_title")),
            r.GetString(r.GetOrdinal("department")),
            r.GetInt32(r.GetOrdinal("fiscal_year")),
            r.GetString(r.GetOrdinal("status")),
            r.GetFieldValue<decimal>(r.GetOrdinal("total_budget")),
            GetNullableString(r, "notes"),
            GetNullableDateTime(r, "submitted_at"),
            GetNullableDateTime(r, "approved_at"),
            r.GetDateTime(r.GetOrdinal("created_at")),
            r.GetDateTime(r.GetOrdinal("updated_at")));
    }

    private static ProcurementPlanItemDetail MapPlanItemDetail(NpgsqlDataReader r)
    {
        return new ProcurementPlanItemDetail(
            r.GetGuid(r.GetOrdinal("plan_item_id")),
            r.GetGuid(r.GetOrdinal("plan_id")),
            GetNullableString(r, "item_code"),
            r.GetString(r.GetOrdinal("description")),
            r.GetString(r.GetOrdinal("budget_code")),
            GetNullableString(r, "procurement_type"),
            r.GetFieldValue<decimal>(r.GetOrdinal("estimated_amount")),
            r.GetString(r.GetOrdinal("status")),
            GetNullableString(r, "notes"),
            r.GetDateTime(r.GetOrdinal("created_at")),
            r.GetDateTime(r.GetOrdinal("updated_at")));
    }

    private static string? GetNullableString(NpgsqlDataReader r, string n)
    {
        var ordinal = r.GetOrdinal(n);
        return r.IsDBNull(ordinal) ? null : r.GetString(ordinal);
    }

    private static DateTime? GetNullableDateTime(NpgsqlDataReader r, string n)
    {
        var ordinal = r.GetOrdinal(n);
        return r.IsDBNull(ordinal) ? null : r.GetDateTime(ordinal);
    }

    private static async Task<long> GetPlanCountAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        int? fiscalYear,
        string? department,
        string? status,
        CancellationToken ct)
    {
        const string sql = "SELECT procurement_workflow.get_procurement_plans_count(@p_fiscal_year, @p_department, @p_status);";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)fiscalYear ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)department ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);

        var result = await cmd.ExecuteScalarAsync(ct);
        return result is null ? 0 : Convert.ToInt64(result);
    }

    private static async Task<ProcurementPlanDetail?> GetPlanDetailAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid planId,
        CancellationToken ct)
    {
        const string sql =
            """
            SELECT
                p.plan_id,
                p.plan_title,
                p.department,
                p.fiscal_year,
                p.status,
                p.total_budget,
                p.notes,
                p.submitted_at,
                p.approved_at,
                p.created_at,
                p.updated_at
            FROM procurement_workflow.procurement_plans p
            WHERE p.plan_id = @p_plan_id;
            """;

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return MapPlanDetail(reader);
    }

    private static async Task<List<ProcurementPlanItemDetail>> GetPlanItemsAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid planId,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("procurement_workflow.get_procurement_plan_items_sp", conn, tx)
        {
            CommandType = CommandType.StoredProcedure
        };

        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
        {
            Direction = ParameterDirection.Output
        });

        return await ExecuteRefcursorAsync(cmd, MapPlanItemDetail, ct);
    }

    private static bool IsStatusValid(string? status, out string? normalizedStatus)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            normalizedStatus = null;
            return true;
        }

        normalizedStatus = AllowedStatuses.FirstOrDefault(s => s.Equals(status.Trim(), StringComparison.OrdinalIgnoreCase));
        return normalizedStatus != null;
    }

    private async Task SyncWorkflowRuntimeAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        ProcurementPlanDetail plan,
        string reason,
        CancellationToken ct)
    {
        await _workflowRuntimeTracker.SyncAsync(
            conn,
            tx,
            new WorkflowRuntimeSyncRequest(
                "procurement_plan",
                plan.PlanId,
                ResolveWorkflowStage(plan.Status),
                plan.Status,
                plan.PlanTitle,
                null,
                null,
                plan.TotalBudget,
                null,
                null,
                reason,
                null),
            ct);
    }

    private static string ResolveWorkflowStage(string status)
    {
        return status switch
        {
            "Draft" => "department_need_capture",
            "Submitted" => "comptroller_procurement_review",
            "Under Review" => "planning_committee_review",
            _ => "app_approval"
        };
    }

    private string? ValidateCreateRequest(ProcurementPlanCreateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = "Draft";

        if (string.IsNullOrWhiteSpace(request.PlanTitle) || request.PlanTitle.Trim().Length < MinTitleLength || request.PlanTitle.Trim().Length > MaxTitleLength)
            return $"PlanTitle must be between {MinTitleLength} and {MaxTitleLength} characters.";

        if (string.IsNullOrWhiteSpace(request.Department) || request.Department.Trim().Length < MinDepartmentLength || request.Department.Trim().Length > MaxDepartmentLength)
            return $"Department must be between {MinDepartmentLength} and {MaxDepartmentLength} characters.";

        if (request.FiscalYear < MinFiscalYear || request.FiscalYear > MaxFiscalYear)
            return $"FiscalYear must be between {MinFiscalYear} and {MaxFiscalYear}.";

        if (request.TotalBudget < 0 || request.TotalBudget > MaxTotalBudget)
            return $"TotalBudget must be between 0 and {MaxTotalBudget}.";

        if (!string.IsNullOrWhiteSpace(request.Status) && !IsStatusValid(request.Status, out normalizedStatus))
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";

        return null;
    }

    private string? ValidateUpdateRequest(ProcurementPlanUpdateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = null;

        if (request.PlanTitle != null && (request.PlanTitle.Trim().Length < MinTitleLength || request.PlanTitle.Trim().Length > MaxTitleLength))
            return $"PlanTitle must be between {MinTitleLength} and {MaxTitleLength} characters.";

        if (request.Department != null && (request.Department.Trim().Length < MinDepartmentLength || request.Department.Trim().Length > MaxDepartmentLength))
            return $"Department must be between {MinDepartmentLength} and {MaxDepartmentLength} characters.";

        if (request.FiscalYear.HasValue && (request.FiscalYear.Value < MinFiscalYear || request.FiscalYear.Value > MaxFiscalYear))
            return $"FiscalYear must be between {MinFiscalYear} and {MaxFiscalYear}.";

        if (request.TotalBudget.HasValue && (request.TotalBudget.Value < 0 || request.TotalBudget.Value > MaxTotalBudget))
            return $"TotalBudget must be between 0 and {MaxTotalBudget}.";

        if (!string.IsNullOrWhiteSpace(request.Status) && !IsStatusValid(request.Status, out normalizedStatus))
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";

        return null;
    }
}

using System.Data;
using System.Security.Claims;
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

            var results = await GetCommitteeCreatedPlansAsync(
                conn,
                tx,
                fiscalYear,
                department,
                status,
                pageSize,
                (page - 1) * pageSize,
                sortBy,
                sortDir,
                ct);
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
        catch (PostgresException ex) when (ex.SqlState == "23505" && ex.ConstraintName == "procurement_plans_unique_title_ux")
        {
            _logger.LogWarning(ex, "Duplicate procurement plan prevented.");
            return Conflict("Procurement plan already exists for this title, department, and fiscal year.");
        }
        catch (PostgresException ex) when (ex.SqlState == "P0001")
        {
            _logger.LogWarning(ex, "Procurement plan validation failed.");
            return Conflict(ex.MessageText);
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

    [HttpPost("{planId:guid}/approval-decision")]
    public async Task<IActionResult> DecideAppApproval(
        Guid planId,
        [FromBody] ProcurementPlanApprovalDecisionRequest request,
        CancellationToken ct)
    {
        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        if (!string.Equals(roleKey, "comptroller_procurement", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(roleKey, "accounting_officer", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(roleKey, "admin", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        var normalizedDecision = NormalizeApprovalDecision(request.Decision);
        if (normalizedDecision is null)
        {
            return BadRequest("Decision must be one of: approve, return, reject.");
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

            var plan = await GetPlanDetailAsync(conn, tx, planId, ct);
            if (plan is null)
            {
                return NotFound();
            }

            if (!string.Equals(plan.CurrentStageKey, "app_approval", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest("Plan is not currently awaiting APP approval.");
            }

            var actor = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name;
            var noteEntry = BuildApprovalDecisionNote(normalizedDecision, request.Note, actor);
            var target = ResolveApprovalDecisionTarget(normalizedDecision);

            await UpdatePlanForApprovalDecisionAsync(conn, tx, planId, target.PlanStatus, noteEntry, target.ApprovedAt, ct);
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
                    "app_approval_decision"),
                ct);

            await tx.CommitAsync(ct);

            return Ok(new ProcurementPlanApprovalDecisionResponse(
                planId,
                normalizedDecision,
                target.Message,
                target.StageKey,
                target.StageTitle,
                target.WorkflowStatus,
                target.PlanStatus,
                target.ApprovedAt));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error applying APP approval decision for plan {PlanId}.", planId);
            return Problem("Internal server error applying APP approval decision.");
        }
    }

    [HttpPost("{planId:guid}/initiate-procurement")]
    public async Task<IActionResult> InitiateProcurement(Guid planId, CancellationToken ct)
    {
        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        if (!string.Equals(roleKey, "comptroller_procurement", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(roleKey, "requisitioning_officer", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(roleKey, "admin", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
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

            var plan = await GetPlanDetailAsync(conn, tx, planId, ct);
            if (plan is null)
            {
                return NotFound();
            }

            if (!string.Equals(plan.CurrentStageKey, "procurement_initiation", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest("Plan is not currently at procurement initiation.");
            }

            var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(
                conn,
                tx,
                "procurement_plan",
                planId,
                "threshold_resolution",
                ct);

            if (!transition.IsAllowed)
            {
                return BadRequest(transition.Message ?? "Threshold resolution is not allowed for this plan.");
            }

            var routeDecision = await _workflowPolicyGuard.ResolveRouteDecisionAsync(
                conn,
                tx,
                "procurement_plan",
                planId,
                ct);

            var actor = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name;
            var routeSummary = routeDecision is null
                ? "Procurement initiated without an active threshold match."
                : $"Procurement initiated. Threshold route: {routeDecision.ApprovalAuthorityLabel ?? routeDecision.ApprovalRoute ?? "Unspecified"}.";

            await _workflowRuntimeTracker.SyncAsync(
                conn,
                tx,
                new WorkflowRuntimeSyncRequest(
                    "procurement_plan",
                    planId,
                    "threshold_resolution",
                    "Under Review",
                    plan.PlanTitle,
                    null,
                    null,
                    plan.TotalBudget,
                    routeDecision?.ProcurementType,
                    routeDecision?.ThresholdId,
                    routeSummary,
                    actor,
                    "procurement_initiation"),
                ct);

            await tx.CommitAsync(ct);

            return Ok(new ProcurementInitiationResponse(
                planId,
                routeSummary,
                "threshold_resolution",
                "Threshold Resolution",
                "Under Review",
                routeDecision?.ThresholdId,
                routeDecision?.ApprovalRoute,
                routeDecision?.ApprovalAuthorityCode,
                routeDecision?.ApprovalAuthorityLabel,
                routeDecision?.RequiresCgisApproval ?? false,
                routeDecision?.RequiresBoard ?? false,
                routeDecision?.RequiresBpp ?? false,
                routeDecision?.GovernanceBodyId,
                routeDecision?.GovernanceBodyName,
                routeDecision?.Amount,
                routeDecision?.ProcurementType,
                routeDecision?.Notes));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initiating procurement for plan {PlanId}.", planId);
            return Problem("Internal server error initiating procurement.");
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
            GetNullableString(r, "current_stage_key"),
            GetNullableString(r, "current_stage_title"),
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
        const string sql = @"
SELECT COUNT(*)
FROM procurement_workflow.procurement_plans p
WHERE
    (EXISTS (
        SELECT 1
        FROM procurement_workflow.planning_committee_plan_links l
        WHERE l.plan_id = p.plan_id
    ) OR EXISTS (
        SELECT 1
        FROM procurement_workflow.planning_committee_decisions d
        WHERE d.plan_id = p.plan_id
    ))
    AND (@p_fiscal_year IS NULL OR p.fiscal_year = @p_fiscal_year)
    AND (@p_department IS NULL OR p.department ILIKE '%' || @p_department || '%')
    AND (@p_status IS NULL OR p.status ILIKE @p_status);";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)fiscalYear ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)department ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);

        var result = await cmd.ExecuteScalarAsync(ct);
        return result is null ? 0 : Convert.ToInt64(result);
    }

    private static async Task<List<ProcurementPlanSummary>> GetCommitteeCreatedPlansAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        int? fiscalYear,
        string? department,
        string? status,
        int limit,
        int offset,
        string sortBy,
        string sortDir,
        CancellationToken ct)
    {
        const string sql = @"
SELECT
    p.plan_id,
    p.plan_title,
    p.department,
    p.fiscal_year,
    p.status,
    p.total_budget,
    p.created_at
FROM procurement_workflow.procurement_plans p
WHERE
    (EXISTS (
        SELECT 1
        FROM procurement_workflow.planning_committee_plan_links l
        WHERE l.plan_id = p.plan_id
    ) OR EXISTS (
        SELECT 1
        FROM procurement_workflow.planning_committee_decisions d
        WHERE d.plan_id = p.plan_id
    ))
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
    CASE WHEN lower(@p_sort_by) = 'total_budget' AND lower(@p_sort_dir) = 'asc' THEN p.total_budget END ASC,
    CASE WHEN lower(@p_sort_by) = 'total_budget' AND lower(@p_sort_dir) = 'desc' THEN p.total_budget END DESC,
    CASE WHEN lower(@p_sort_by) = 'created_at' AND lower(@p_sort_dir) = 'asc' THEN p.created_at END ASC,
    CASE WHEN lower(@p_sort_by) = 'created_at' AND lower(@p_sort_dir) = 'desc' THEN p.created_at END DESC,
    p.created_at DESC
LIMIT @p_limit
OFFSET @p_offset;";

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
        {
            results.Add(MapPlanSummary(reader));
        }

        return results;
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
                wi.current_stage_key,
                sc.stage_title AS current_stage_title,
                p.total_budget,
                p.notes,
                p.submitted_at,
                p.approved_at,
                p.created_at,
                p.updated_at
            FROM procurement_workflow.procurement_plans p
            LEFT JOIN procurement_workflow.workflow_instances wi
                ON wi.entity_type = 'procurement_plan'
               AND wi.entity_id = p.plan_id
            LEFT JOIN procurement_workflow.workflow_stage_catalog sc
                ON sc.stage_key = wi.current_stage_key
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
        const string sql = @"
            SELECT
                i.plan_item_id,
                i.plan_id,
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
              AND (
                    NOT EXISTS (
                        SELECT 1
                        FROM procurement_workflow.requisitions r
                        WHERE r.app_item_id = i.plan_item_id
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM procurement_workflow.requisitions r
                        JOIN procurement_workflow.planning_committee_decisions d
                          ON d.requisition_id = r.requisition_id
                        WHERE r.app_item_id = i.plan_item_id
                          AND d.overall_decision = 'Recommended'
                    )
                  )
            ORDER BY i.created_at ASC;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);

        var results = new List<ProcurementPlanItemDetail>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(MapPlanItemDetail(reader));
        }

        return results;
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

    private static string? NormalizeApprovalDecision(string? decision)
    {
        if (string.IsNullOrWhiteSpace(decision))
        {
            return null;
        }

        return decision.Trim().ToLowerInvariant() switch
        {
            "approve" => "approve",
            "return" => "return",
            "reject" => "reject",
            _ => null
        };
    }

    private static string BuildApprovalDecisionNote(string decision, string? note, string? actor)
    {
        var stamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss 'UTC'");
        var actorLabel = string.IsNullOrWhiteSpace(actor) ? "system" : actor.Trim();
        var message = string.IsNullOrWhiteSpace(note) ? "No note supplied." : note.Trim();
        return $"[{stamp}] APP approval {decision}: {message} (actor: {actorLabel})";
    }

    private static ApprovalDecisionTarget ResolveApprovalDecisionTarget(string decision)
    {
        return decision switch
        {
            "approve" => new ApprovalDecisionTarget(
                "procurement_initiation",
                "Procurement Initiation",
                "Approved",
                "Approved",
                "APP approved and released to procurement initiation.",
                DateTime.UtcNow),
            "return" => new ApprovalDecisionTarget(
                "comptroller_procurement_review",
                "Comptroller Procurement Review",
                "Returned",
                "Submitted",
                "APP returned to Comptroller Procurement Review for correction.",
                null),
            "reject" => new ApprovalDecisionTarget(
                "app_approval",
                "APP Approval",
                "Rejected",
                "Rejected",
                "APP rejected at approval stage.",
                null),
            _ => throw new InvalidOperationException("Unknown APP approval decision.")
        };
    }

    private static async Task UpdatePlanForApprovalDecisionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid planId,
        string planStatus,
        string noteEntry,
        DateTime? approvedAt,
        CancellationToken ct)
    {
        const string sql = @"
UPDATE procurement_workflow.procurement_plans
SET
    status = @p_status,
    approved_at = @p_approved_at,
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
        cmd.Parameters.AddWithValue("p_approved_at", NpgsqlDbType.Timestamp, (object?)approvedAt ?? DBNull.Value);

        var affected = await cmd.ExecuteNonQueryAsync(ct);
        if (affected == 0)
        {
            throw new InvalidOperationException("Procurement plan could not be updated.");
        }
    }

    private sealed record ApprovalDecisionTarget(
        string StageKey,
        string StageTitle,
        string WorkflowStatus,
        string PlanStatus,
        string Message,
        DateTime? ApprovedAt);
}

using System.Data;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/requisitions")]
public class RequisitionsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<RequisitionsController> _logger;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

    private static readonly string[] AllowedStatuses =
    {
        "Draft",
        "Submitted",
        "Under Review",
        "Evaluation",
        "Board Review",
        "Approved",
        "Rejected",
        "Cancelled"
    };

    private static readonly string[] AllowedPriorities = { "Normal", "Urgent", "Strategic" };
    private static readonly string[] AllowedProcurementTypes = { "Goods", "Works", "Services" };
    private const int MinTitleLength = 5;
    private const int MaxTitleLength = 255;
    private const int MinDepartmentLength = 3;
    private const int MaxDepartmentLength = 150;
    private const int MaxBudgetCodeLength = 60;
    private const int MaxProjectCodeLength = 60;
    private const int DefaultPageSize = 10;
    private const int MaxPageSize = 100;
    private static readonly HashSet<string> AllowedSortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "title",
        "department",
        "status",
        "priority",
        "total_estimate",
        "created_at",
        "required_by"
    };

    private static readonly HashSet<string> AllowedSortDirections = new(StringComparer.OrdinalIgnoreCase)
    {
        "asc",
        "desc"
    };

    public RequisitionsController(
        IConfiguration config,
        ILogger<RequisitionsController> logger,
        WorkflowRuntimeTracker workflowRuntimeTracker)
    {
        _config = config;
        _logger = logger;
        _workflowRuntimeTracker = workflowRuntimeTracker;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    [HttpGet]
    public async Task<IActionResult> GetRequisitions(
        [FromQuery] string? status,
        [FromQuery] string? department,
        [FromQuery] string? priority,
        [FromQuery] string? query,
        [FromQuery] DateTime? dateFrom,
        [FromQuery] DateTime? dateTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        [FromQuery] string? sortBy = "created_at",
        [FromQuery] string? sortDir = "desc",
        CancellationToken ct = default)
    {
        if (!IsStatusValid(status, out _))
        {
            return BadRequest($"Status must be one of: {string.Join(", ", AllowedStatuses)}.");
        }

        if (!IsPriorityValid(priority, out _))
        {
            return BadRequest($"Priority must be one of: {string.Join(", ", AllowedPriorities)}.");
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

            var total = await GetRequisitionCountAsync(conn, tx, status, department, priority, query, dateFrom, dateTo, ct);

            await using var cmd = new NpgsqlCommand("procurement_workflow.get_requisitions_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)department ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_priority", NpgsqlDbType.Varchar, (object?)priority ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_date_from", NpgsqlDbType.Timestamp, (object?)dateFrom ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_date_to", NpgsqlDbType.Timestamp, (object?)dateTo ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_sort_by", NpgsqlDbType.Varchar, sortBy);
            cmd.Parameters.AddWithValue("p_sort_dir", NpgsqlDbType.Varchar, sortDir);
            cmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, pageSize);
            cmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, (page - 1) * pageSize);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapSummary, ct);
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
            _logger.LogError(ex, "Error retrieving requisitions.");
            return Problem("Internal server error retrieving requisitions.");
        }
    }

    [HttpGet("{requisitionId:guid}")]
    public async Task<IActionResult> GetRequisitionDetail(Guid requisitionId, CancellationToken ct)
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

            await using var cmd = new NpgsqlCommand("procurement_workflow.get_requisition_detail_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var details = await ExecuteRefcursorAsync(cmd, MapDetailWithoutItems, ct);
            var detail = details.FirstOrDefault();
            if (detail is null)
            {
                return NotFound();
            }

            var lineItems = await GetLineItemsAsync(conn, tx, requisitionId, ct);
            await tx.CommitAsync(ct);

            return Ok(detail with { LineItems = lineItems });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving requisition {RequisitionId}.", requisitionId);
            return Problem("Internal server error retrieving requisition.");
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateRequisition([FromBody] RequisitionCreateRequest request, CancellationToken ct)
    {
        if (request is null)
        {
            return BadRequest("Request body is required.");
        }

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

            await using var cmd = new NpgsqlCommand("procurement_workflow.create_requisition_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_title", NpgsqlDbType.Varchar, request.Title);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, request.Department);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_priority", NpgsqlDbType.Varchar, (object?)request.Priority ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_procurement_type", NpgsqlDbType.Varchar, (object?)request.ProcurementType ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_funding_source", NpgsqlDbType.Varchar, (object?)request.FundingSource ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, (object?)request.BudgetCode ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_app_item_id", NpgsqlDbType.Uuid, (object?)request.AppItemId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_project_code", NpgsqlDbType.Varchar, (object?)request.ProjectCode ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_required_by", NpgsqlDbType.Timestamp, (object?)request.RequiredBy ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_delivery_location", NpgsqlDbType.Text, (object?)request.DeliveryLocation ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_justification", NpgsqlDbType.Text, (object?)request.Justification ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_risk_notes", NpgsqlDbType.Text, (object?)request.RiskNotes ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_line_items", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(request.LineItems));
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapDetailWithoutItems, ct);
            var detail = results.FirstOrDefault();
            if (detail is null)
            {
                return Problem("Requisition creation failed.");
            }

            var lineItems = await GetLineItemsAsync(conn, tx, detail.RequisitionId, ct);
            var response = detail with { LineItems = lineItems };
            await SyncWorkflowRuntimeAsync(conn, tx, response, "Requisition created.", ct);
            await tx.CommitAsync(ct);
            return Created($"/api/requisitions/{response.RequisitionId}", response);
        }
        catch (PostgresException ex) when (ex.SqlState == "P0001")
        {
            _logger.LogWarning(ex, "Budget validation failed while creating requisition.");
            return Conflict(ex.MessageText);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating requisition.");
            return Problem("Internal server error creating requisition.");
        }
    }

    [HttpPut("{requisitionId:guid}")]
    public async Task<IActionResult> UpdateRequisition(Guid requisitionId, [FromBody] RequisitionUpdateRequest request, CancellationToken ct)
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

            await using var cmd = new NpgsqlCommand("procurement_workflow.update_requisition_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
            cmd.Parameters.AddWithValue("p_title", NpgsqlDbType.Varchar, (object?)request.Title ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)request.Department ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_priority", NpgsqlDbType.Varchar, (object?)request.Priority ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_procurement_type", NpgsqlDbType.Varchar, (object?)request.ProcurementType ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_funding_source", NpgsqlDbType.Varchar, (object?)request.FundingSource ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, (object?)request.BudgetCode ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_app_item_id", NpgsqlDbType.Uuid, (object?)request.AppItemId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_project_code", NpgsqlDbType.Varchar, (object?)request.ProjectCode ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_required_by", NpgsqlDbType.Timestamp, (object?)request.RequiredBy ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_delivery_location", NpgsqlDbType.Text, (object?)request.DeliveryLocation ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_justification", NpgsqlDbType.Text, (object?)request.Justification ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_risk_notes", NpgsqlDbType.Text, (object?)request.RiskNotes ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_line_items", NpgsqlDbType.Jsonb, (object?)request.LineItems is null
                ? DBNull.Value
                : JsonSerializer.Serialize(request.LineItems));
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapDetailWithoutItems, ct);
            var detail = results.FirstOrDefault();
            if (detail is null)
            {
                return NotFound();
            }

            var lineItems = await GetLineItemsAsync(conn, tx, requisitionId, ct);
            var response = detail with { LineItems = lineItems };
            await SyncWorkflowRuntimeAsync(conn, tx, response, "Requisition updated.", ct);
            await tx.CommitAsync(ct);

            return Ok(response);
        }
        catch (PostgresException ex) when (ex.SqlState == "P0001")
        {
            _logger.LogWarning(ex, "Budget validation failed while updating requisition {RequisitionId}.", requisitionId);
            return Conflict(ex.MessageText);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating requisition {RequisitionId}.", requisitionId);
            return Problem("Internal server error updating requisition.");
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

    private static RequisitionSummary MapSummary(NpgsqlDataReader r)
    {
        return new RequisitionSummary(
            r.GetGuid(r.GetOrdinal("requisition_id")),
            r.GetString(r.GetOrdinal("title")),
            r.GetString(r.GetOrdinal("department")),
            r.GetString(r.GetOrdinal("status")),
            GetNullableString(r, "priority"),
            GetNullableString(r, "funding_source"),
            r.GetFieldValue<decimal>(r.GetOrdinal("total_estimate")),
            GetNullableDateTime(r, "required_by"),
            r.GetDateTime(r.GetOrdinal("created_at")));
    }

    private static RequisitionDetail MapDetailWithoutItems(NpgsqlDataReader r)
    {
        return new RequisitionDetail(
            r.GetGuid(r.GetOrdinal("requisition_id")),
            r.GetString(r.GetOrdinal("title")),
            r.GetString(r.GetOrdinal("department")),
            r.GetString(r.GetOrdinal("status")),
            GetNullableString(r, "priority"),
            GetNullableString(r, "funding_source"),
            r.GetFieldValue<decimal>(r.GetOrdinal("total_estimate")),
            GetNullableDateTime(r, "required_by"),
            r.GetDateTime(r.GetOrdinal("created_at")),
            GetNullableString(r, "procurement_type"),
            GetNullableString(r, "budget_code"),
            GetNullableGuid(r, "app_item_id"),
            GetNullableString(r, "project_code"),
            GetNullableString(r, "delivery_location"),
            GetNullableString(r, "justification"),
            GetNullableString(r, "risk_notes"),
            new List<RequisitionLineItemDto>(),
            r.GetDateTime(r.GetOrdinal("updated_at")),
            GetNullableString(r, "current_stage"));
    }

    private static RequisitionLineItemDto MapLineItem(NpgsqlDataReader r)
    {
        return new RequisitionLineItemDto(
            GetNullableString(r, "item_code"),
            r.GetString(r.GetOrdinal("description")),
            r.GetString(r.GetOrdinal("unit")),
            r.GetFieldValue<decimal>(r.GetOrdinal("quantity")),
            r.GetFieldValue<decimal>(r.GetOrdinal("unit_cost")));
    }

    private static async Task<List<RequisitionLineItemDto>> GetLineItemsAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid requisitionId,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("procurement_workflow.get_requisition_line_items_sp", conn, tx)
        {
            CommandType = CommandType.StoredProcedure
        };

        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
        {
            Direction = ParameterDirection.Output
        });

        return await ExecuteRefcursorAsync(cmd, MapLineItem, ct);
    }

    private static int GetOptionalOrdinal(NpgsqlDataReader r, string n)
    {
        for (var i = 0; i < r.FieldCount; i++)
        {
            if (string.Equals(r.GetName(i), n, StringComparison.OrdinalIgnoreCase))
            {
                return i;
            }
        }

        return -1;
    }

    private static string? GetNullableString(NpgsqlDataReader r, string n)
    {
        var ordinal = GetOptionalOrdinal(r, n);
        if (ordinal < 0 || r.IsDBNull(ordinal))
        {
            return null;
        }

        return r.GetString(ordinal);
    }

    private static DateTime? GetNullableDateTime(NpgsqlDataReader r, string n)
    {
        var ordinal = GetOptionalOrdinal(r, n);
        if (ordinal < 0 || r.IsDBNull(ordinal))
        {
            return null;
        }

        return r.GetDateTime(ordinal);
    }

    private static Guid? GetNullableGuid(NpgsqlDataReader r, string n)
    {
        var ordinal = GetOptionalOrdinal(r, n);
        if (ordinal < 0 || r.IsDBNull(ordinal))
        {
            return null;
        }

        return r.GetGuid(ordinal);
    }

    private async Task SyncWorkflowRuntimeAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        RequisitionDetail requisition,
        string reason,
        CancellationToken ct)
    {
        await _workflowRuntimeTracker.SyncAsync(
            conn,
            tx,
            new WorkflowRuntimeSyncRequest(
                "requisition",
                requisition.RequisitionId,
                ResolveWorkflowStage(requisition.Status),
                requisition.Status,
                requisition.Title,
                requisition.AppItemId.HasValue ? "procurement_plan_item" : null,
                requisition.AppItemId,
                requisition.TotalEstimate,
                requisition.ProcurementType,
                null,
                reason,
                null),
            ct);
    }

    private static string ResolveWorkflowStage(string status)
    {
        return status switch
        {
            "Draft" => "procurement_initiation",
            "Submitted" => "threshold_resolution",
            "Under Review" => "threshold_resolution",
            "Evaluation" => "evaluation",
            "Board Review" => "tenders_board_review",
            "Approved" => "accounting_officer_review",
            _ => "procurement_initiation"
        };
    }

    private static async Task<long> GetRequisitionCountAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string? status,
        string? department,
        string? priority,
        string? query,
        DateTime? dateFrom,
        DateTime? dateTo,
        CancellationToken ct)
    {
        const string sql = "SELECT procurement_workflow.get_requisitions_count(@p_status, @p_department, @p_priority, @p_query, @p_date_from, @p_date_to);";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)department ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_priority", NpgsqlDbType.Varchar, (object?)priority ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_date_from", NpgsqlDbType.Timestamp, (object?)dateFrom ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_date_to", NpgsqlDbType.Timestamp, (object?)dateTo ?? DBNull.Value);

        var result = await cmd.ExecuteScalarAsync(ct);
        return result is null ? 0 : Convert.ToInt64(result);
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

    private static bool IsPriorityValid(string? priority, out string? normalizedPriority)
    {
        if (string.IsNullOrWhiteSpace(priority))
        {
            normalizedPriority = null;
            return true;
        }

        normalizedPriority = AllowedPriorities.FirstOrDefault(p => p.Equals(priority.Trim(), StringComparison.OrdinalIgnoreCase));
        return normalizedPriority != null;
    }

    private static bool IsProcurementTypeValid(string? procurementType, out string? normalizedType)
    {
        if (string.IsNullOrWhiteSpace(procurementType))
        {
            normalizedType = null;
            return true;
        }

        normalizedType = AllowedProcurementTypes.FirstOrDefault(p => p.Equals(procurementType.Trim(), StringComparison.OrdinalIgnoreCase));
        return normalizedType != null;
    }

    private string? ValidateCreateRequest(RequisitionCreateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = "Draft";

        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length < MinTitleLength || request.Title.Trim().Length > MaxTitleLength)
            return $"Title must be between {MinTitleLength} and {MaxTitleLength} characters.";

        if (string.IsNullOrWhiteSpace(request.Department) || request.Department.Trim().Length < MinDepartmentLength || request.Department.Trim().Length > MaxDepartmentLength)
            return $"Department must be between {MinDepartmentLength} and {MaxDepartmentLength} characters.";

        if (!string.IsNullOrWhiteSpace(request.BudgetCode) && request.BudgetCode.Trim().Length > MaxBudgetCodeLength)
            return $"BudgetCode must be {MaxBudgetCodeLength} characters or fewer.";

        if (request.AppItemId.HasValue && request.AppItemId.Value == Guid.Empty)
            return "AppItemId must be a valid GUID.";

        if (!string.IsNullOrWhiteSpace(request.ProjectCode) && request.ProjectCode.Trim().Length > MaxProjectCodeLength)
            return $"ProjectCode must be {MaxProjectCodeLength} characters or fewer.";

        if (!string.IsNullOrWhiteSpace(request.Status) && !IsStatusValid(request.Status, out normalizedStatus))
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";

        if (!string.IsNullOrWhiteSpace(request.Priority) && !IsPriorityValid(request.Priority, out _))
            return $"Priority must be one of: {string.Join(", ", AllowedPriorities)}.";

        if (!string.IsNullOrWhiteSpace(request.ProcurementType) && !IsProcurementTypeValid(request.ProcurementType, out _))
            return $"ProcurementType must be one of: {string.Join(", ", AllowedProcurementTypes)}.";

        if (request.LineItems is null || request.LineItems.Count == 0)
            return "At least one line item is required.";

        foreach (var item in request.LineItems)
        {
            if (string.IsNullOrWhiteSpace(item.Description))
                return "Line item description is required.";

            if (string.IsNullOrWhiteSpace(item.Unit))
                return "Line item unit is required.";

            if (item.Quantity <= 0)
                return "Line item quantity must be greater than 0.";

            if (item.UnitCost <= 0)
                return "Line item unit cost must be greater than 0.";
        }

        return null;
    }

    private string? ValidateUpdateRequest(RequisitionUpdateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = null;

        if (request.Title is not null && (request.Title.Trim().Length < MinTitleLength || request.Title.Trim().Length > MaxTitleLength))
            return $"Title must be between {MinTitleLength} and {MaxTitleLength} characters.";

        if (request.Department is not null && (request.Department.Trim().Length < MinDepartmentLength || request.Department.Trim().Length > MaxDepartmentLength))
            return $"Department must be between {MinDepartmentLength} and {MaxDepartmentLength} characters.";

        if (request.BudgetCode is not null && request.BudgetCode.Trim().Length > MaxBudgetCodeLength)
            return $"BudgetCode must be {MaxBudgetCodeLength} characters or fewer.";

        if (request.AppItemId.HasValue && request.AppItemId.Value == Guid.Empty)
            return "AppItemId must be a valid GUID.";

        if (request.ProjectCode is not null && request.ProjectCode.Trim().Length > MaxProjectCodeLength)
            return $"ProjectCode must be {MaxProjectCodeLength} characters or fewer.";

        if (!string.IsNullOrWhiteSpace(request.Status) && !IsStatusValid(request.Status, out normalizedStatus))
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";

        if (!string.IsNullOrWhiteSpace(request.Priority) && !IsPriorityValid(request.Priority, out _))
            return $"Priority must be one of: {string.Join(", ", AllowedPriorities)}.";

        if (!string.IsNullOrWhiteSpace(request.ProcurementType) && !IsProcurementTypeValid(request.ProcurementType, out _))
            return $"ProcurementType must be one of: {string.Join(", ", AllowedProcurementTypes)}.";

        if (request.LineItems is not null)
        {
            if (request.LineItems.Count == 0)
                return "Line items cannot be empty.";

            foreach (var item in request.LineItems)
            {
                if (string.IsNullOrWhiteSpace(item.Description))
                    return "Line item description is required.";

                if (string.IsNullOrWhiteSpace(item.Unit))
                    return "Line item unit is required.";

                if (item.Quantity <= 0)
                    return "Line item quantity must be greater than 0.";

                if (item.UnitCost <= 0)
                    return "Line item unit cost must be greater than 0.";
            }
        }

        return null;
    }
}

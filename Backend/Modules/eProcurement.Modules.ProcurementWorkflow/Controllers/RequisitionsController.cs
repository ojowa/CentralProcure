using System.Data;
using System.Text.Json;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/requisitions")]
public partial class RequisitionsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<RequisitionsController> _logger;
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
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
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

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
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

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
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)request.Department ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_unit_id", NpgsqlDbType.Uuid, (object?)request.UnitId ?? DBNull.Value);
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
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

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

            if (!string.IsNullOrWhiteSpace(normalizedStatus))
            {
                var threshold = await ResolveThresholdForRequestAsync(conn, tx, requisitionId, request, ct);
                var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(
                    conn,
                    tx,
                    "requisition",
                    requisitionId,
                    ResolveWorkflowStage(normalizedStatus, threshold),
                    ct);

                if (!transition.IsAllowed)
                {
                    return BadRequest(transition.Message);
                }
            }

            await using var cmd = new NpgsqlCommand("procurement_workflow.update_requisition_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
            cmd.Parameters.AddWithValue("p_title", NpgsqlDbType.Varchar, (object?)request.Title ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)request.Department ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_unit_id", NpgsqlDbType.Uuid, (object?)request.UnitId ?? DBNull.Value);
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
            cmd.Parameters.AddWithValue("p_line_items", NpgsqlDbType.Jsonb, (object?)request.LineItems is null ? DBNull.Value : JsonSerializer.Serialize(request.LineItems));
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

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
}

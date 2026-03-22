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
    private readonly WorkflowActionGrantService _workflowActionGrantService;

    private static readonly string[] AllowedStatuses =
    {
        "Draft",
        "Submitted",
        "Endorsed",
        "Initial",
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
        WorkflowRuntimeTracker workflowRuntimeTracker,
        WorkflowActionGrantService workflowActionGrantService)
    {
        _config = config;
        _logger = logger;
        _workflowPolicyGuard = workflowPolicyGuard;
        _workflowRuntimeTracker = workflowRuntimeTracker;
        _workflowActionGrantService = workflowActionGrantService;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    [HttpDelete("{requisitionId:guid}")]
    public async Task<IActionResult> DeleteRequisition(Guid requisitionId, CancellationToken ct)
    {
        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        if (!string.Equals(roleKey, "admin", StringComparison.OrdinalIgnoreCase))
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

            await using var cmd = new NpgsqlCommand("procurement_workflow.delete_requisition_sp", conn)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
            await cmd.ExecuteNonQueryAsync(ct);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting requisition {RequisitionId}.", requisitionId);
            return Problem("Internal server error deleting requisition.");
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateRequisition([FromBody] RequisitionCreateRequest request, CancellationToken ct)
    {
        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        if (!string.Equals(roleKey, "requisitioning_officer", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(roleKey, "admin", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        if (request is null)
        {
            return BadRequest("Request body is required.");
        }

        if (request.AppItemId.HasValue)
        {
            return BadRequest("APP item assignment is controlled by finalized planning committee review and cannot be set directly.");
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
            var detail = (await ApplyFinalCommitteeDecisionsAsync(conn, tx, results, ct)).FirstOrDefault();
            if (detail is null)
            {
                return Problem("Requisition creation failed.");
            }

            var lineItems = await GetLineItemsAsync(conn, tx, detail.RequisitionId, ct);
            var response = detail with { LineItems = lineItems };
            await SyncWorkflowRuntimeAsync(conn, tx, response, "Requisition created.", ct);
            await tx.CommitAsync(ct);
            response = await EnrichDetailWithAuthorityAsync(connectionString, response, ct);
            response = await EnrichDetailWithRoutingAsync(connectionString, response, ct);
            return Created($"/api/requisitions/{response.RequisitionId}", response);
        }
        catch (PostgresException ex) when (ex.SqlState == "23505" && ex.ConstraintName == "requisitions_app_item_id_ux")
        {
            _logger.LogWarning(ex, "Duplicate APP item link while creating requisition.");
            return Conflict("APP item is already linked to another requisition.");
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

            var hasAction = await _workflowActionGrantService.HasRequiredActionAsync(
                conn,
                tx,
                User,
                "requisition",
                requisitionId,
                "requisition.update",
                ct);
            if (!hasAction)
            {
                return Forbid();
            }

            var existingAppItemId = await GetExistingAppItemIdAsync(conn, tx, requisitionId, ct);
            if (request.AppItemId.HasValue && request.AppItemId != existingAppItemId)
            {
                return BadRequest("APP item assignment is controlled by finalized planning committee review and cannot be changed directly.");
            }

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
            var detail = (await ApplyFinalCommitteeDecisionsAsync(conn, tx, results, ct)).FirstOrDefault();
            if (detail is null)
            {
                return NotFound();
            }

            var lineItems = await GetLineItemsAsync(conn, tx, requisitionId, ct);
            var response = detail with { LineItems = lineItems };
            await SyncWorkflowRuntimeAsync(conn, tx, response, "Requisition updated.", ct);
            await tx.CommitAsync(ct);
            response = await EnrichDetailWithAuthorityAsync(connectionString, response, ct);
            response = await EnrichDetailWithRoutingAsync(connectionString, response, ct);
            return Ok(response);
        }
        catch (PostgresException ex) when (ex.SqlState == "23505" && ex.ConstraintName == "requisitions_app_item_id_ux")
        {
            _logger.LogWarning(ex, "Duplicate APP item link while updating requisition {RequisitionId}.", requisitionId);
            return Conflict("APP item is already linked to another requisition.");
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

    public sealed record UnlinkAppRequest(string Reason);

    [HttpPost("{requisitionId:guid}/unlink-app")]
    public async Task<IActionResult> UnlinkAppItem(Guid requisitionId, [FromBody] UnlinkAppRequest request, CancellationToken ct)
    {
        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        if (!string.Equals(roleKey, "financial_unit_officer", StringComparison.OrdinalIgnoreCase))
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

            await using var cmd = new NpgsqlCommand("procurement_workflow.unlink_requisition_app_item_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
            cmd.Parameters.AddWithValue("p_reason", NpgsqlDbType.Text, request?.Reason ?? string.Empty);
            cmd.Parameters.AddWithValue("p_unlinked_by", NpgsqlDbType.Varchar, User.Identity?.Name ?? string.Empty);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            var results = await ExecuteRefcursorAsync(cmd, r => new
            {
                RequisitionId = r.GetGuid(r.GetOrdinal("requisition_id")),
                AppItemId = GetNullableGuid(r, "app_item_id"),
                UpdatedAt = r.GetDateTime(r.GetOrdinal("updated_at"))
            }, ct);

            var result = results.FirstOrDefault();
            if (result is null)
            {
                return NotFound();
            }

            await tx.CommitAsync(ct);
            return Ok(result);
        }
        catch (PostgresException ex) when (ex.SqlState == "P0001")
        {
            _logger.LogWarning(ex, "Unlink validation failed for requisition {RequisitionId}.", requisitionId);
            return BadRequest(ex.MessageText);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unlinking APP item for requisition {RequisitionId}.", requisitionId);
            return Problem("Internal server error unlinking APP item.");
        }
    }
}

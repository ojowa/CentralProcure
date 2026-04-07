using System.Security.Claims;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Authorize]
[Route("api/procurement-methods")]
public partial class ProcurementMethodsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

    public ProcurementMethodsController(
        IConfiguration config,
        WorkflowPolicyGuard workflowPolicyGuard,
        WorkflowRuntimeTracker workflowRuntimeTracker)
    {
        _config = config;
        _workflowPolicyGuard = workflowPolicyGuard;
        _workflowRuntimeTracker = workflowRuntimeTracker;
    }

    [HttpGet("queue")]
    public async Task<IActionResult> GetQueue(CancellationToken ct)
    {
        if (!CanManageMethods())
        {
            return Forbid();
        }

        await using var conn = await OpenConnectionAsync(ct);

        const string sql = @"
SELECT
    wi.entity_type,
    wi.entity_id,
    wi.record_title,
    wi.current_stage_key,
    sc.stage_title AS current_stage_title,
    wi.amount,
    wi.procurement_type,
    at.approval_route,
    at.approval_authority_label,
    pmd.selected_method,
    pmd.determined_at AS last_determined_at,
    pmce.status AS active_exception_status
FROM procurement_workflow.workflow_instances wi
JOIN procurement_workflow.workflow_stage_catalog sc
    ON sc.stage_key = wi.current_stage_key
LEFT JOIN procurement_workflow.approval_thresholds at
    ON at.threshold_id = wi.threshold_id
LEFT JOIN LATERAL (
    SELECT selected_method, determined_at
    FROM procurement_workflow.procurement_method_decisions d
    WHERE d.entity_type = wi.entity_type
      AND d.entity_id = wi.entity_id
      AND d.superseded_by_decision_id IS NULL
    ORDER BY d.determined_at DESC
    LIMIT 1
) pmd ON TRUE
LEFT JOIN LATERAL (
    SELECT status
    FROM procurement_workflow.procurement_method_change_exceptions e
    WHERE e.entity_type = wi.entity_type
      AND e.entity_id = wi.entity_id
      AND e.status IN ('PendingReview', 'ReturnedForClarification')
    ORDER BY e.requested_at DESC
    LIMIT 1
) pmce ON TRUE
WHERE COALESCE(at.requires_cgis_approval, FALSE) = TRUE
  AND wi.current_stage_key IN ('threshold_resolution', 'method_validation', 'solicitation', 'bid_opening', 'evaluation', 'accounting_officer_review')
ORDER BY wi.updated_at DESC, wi.created_at DESC;";

        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);

        var results = new List<ProcurementMethodQueueItemDto>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(new ProcurementMethodQueueItemDto(
                reader.GetString(reader.GetOrdinal("entity_type")),
                reader.GetGuid(reader.GetOrdinal("entity_id")),
                GetNullableString(reader, "record_title"),
                reader.GetString(reader.GetOrdinal("current_stage_key")),
                reader.GetString(reader.GetOrdinal("current_stage_title")),
                GetNullableDecimal(reader, "amount"),
                GetNullableString(reader, "procurement_type"),
                GetNullableString(reader, "approval_route"),
                GetNullableString(reader, "approval_authority_label"),
                GetNullableString(reader, "selected_method"),
                GetNullableDateTime(reader, "last_determined_at"),
                GetNullableString(reader, "active_exception_status")));
        }

        return Ok(results);
    }

    [HttpGet("{entityType}/{entityId:guid}")]
    public async Task<IActionResult> GetDetail(string entityType, Guid entityId, CancellationToken ct)
    {
        if (!CanViewMethods())
        {
            return Forbid();
        }

        await using var conn = await OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var routeDecision = await _workflowPolicyGuard.ResolveRouteDecisionAsync(conn, tx, entityType, entityId, ct);
        var runtime = await GetRuntimeAsync(conn, tx, entityType, entityId, ct);
        if (routeDecision is null || runtime is null)
        {
            await tx.RollbackAsync(ct);
            return NotFound();
        }

        var currentDecision = await GetCurrentDecisionAsync(conn, tx, entityType, entityId, ct);
        var activeException = await GetActiveExceptionAsync(conn, tx, entityType, entityId, ct);
        var recentExceptions = await GetRecentExceptionsAsync(conn, tx, entityType, entityId, ct);
        await tx.CommitAsync(ct);

        return Ok(new ProcurementMethodDetailDto(
            runtime.EntityType,
            runtime.EntityId,
            runtime.RecordTitle,
            runtime.CurrentStageKey,
            runtime.CurrentStageTitle,
            runtime.Amount,
            runtime.ProcurementType,
            routeDecision.ApprovalRoute,
            routeDecision.ApprovalAuthorityLabel,
            routeDecision.RequiresCgisApproval,
            routeDecision.RequiresBoard,
            routeDecision.RequiresBpp,
            currentDecision,
            activeException,
            recentExceptions));
    }

    [HttpGet("exceptions/queue")]
    public async Task<IActionResult> GetExceptionQueue(CancellationToken ct)
    {
        if (!CanReviewExceptions())
        {
            return Forbid();
        }

        await using var conn = await OpenConnectionAsync(ct);

        const string sql = @"
SELECT
    e.exception_id,
    e.entity_type,
    e.entity_id,
    wi.record_title,
    wi.current_stage_key,
    sc.stage_title AS current_stage_title,
    wi.amount,
    e.current_method,
    e.requested_method,
    e.request_reason,
    e.requested_by,
    e.requested_at,
    e.status
FROM procurement_workflow.procurement_method_change_exceptions e
JOIN procurement_workflow.workflow_instances wi
    ON wi.entity_type = e.entity_type
   AND wi.entity_id = e.entity_id
JOIN procurement_workflow.workflow_stage_catalog sc
    ON sc.stage_key = wi.current_stage_key
WHERE e.status IN ('PendingReview', 'ReturnedForClarification')
ORDER BY e.requested_at DESC;";

        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<object>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(new
            {
                ExceptionId = reader.GetGuid(reader.GetOrdinal("exception_id")),
                EntityType = reader.GetString(reader.GetOrdinal("entity_type")),
                EntityId = reader.GetGuid(reader.GetOrdinal("entity_id")),
                RecordTitle = GetNullableString(reader, "record_title"),
                CurrentStageKey = reader.GetString(reader.GetOrdinal("current_stage_key")),
                CurrentStageTitle = reader.GetString(reader.GetOrdinal("current_stage_title")),
                Amount = GetNullableDecimal(reader, "amount"),
                CurrentMethod = reader.GetString(reader.GetOrdinal("current_method")),
                RequestedMethod = reader.GetString(reader.GetOrdinal("requested_method")),
                RequestReason = reader.GetString(reader.GetOrdinal("request_reason")),
                RequestedBy = GetNullableString(reader, "requested_by"),
                RequestedAt = reader.GetDateTime(reader.GetOrdinal("requested_at")),
                Status = reader.GetString(reader.GetOrdinal("status"))
            });
        }

        return Ok(results);
    }

    private async Task<NpgsqlConnection> OpenConnectionAsync(CancellationToken ct)
    {
        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("Connection string 'Primary' is not configured.");
        }

        var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);
        return conn;
    }

    private bool CanManageMethods()
    {
        var role = WorkflowActionGrantService.ResolveRoleKey(User);
        return string.Equals(role, "comptroller_procurement", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase);
    }

    private bool CanReviewExceptions()
    {
        var role = WorkflowActionGrantService.ResolveRoleKey(User);
        return string.Equals(role, "accounting_officer", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase);
    }

    private bool CanViewMethods() => CanManageMethods() || CanReviewExceptions();

    private string? ResolveActor()
        => User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name;

    private static string NormalizeEntityType(string value) => value.Trim().ToLowerInvariant();

    private static bool TryNormalizeMethod(string? value, out string method)
    {
        method = (value ?? string.Empty).Replace(" ", string.Empty).Trim() switch
        {
            "CompetitiveTender" => "CompetitiveTender",
            "SimplifiedQuotation" => "SimplifiedQuotation",
            _ => string.Empty
        };

        return !string.IsNullOrWhiteSpace(method);
    }

    private sealed record RuntimeDetail(
        string EntityType,
        Guid EntityId,
        string CurrentStageKey,
        string CurrentStageTitle,
        string? RecordTitle,
        string? ParentEntityType,
        Guid? ParentEntityId,
        decimal? Amount,
        string? ProcurementType,
        Guid? ThresholdId);

    private sealed record MethodExceptionRow(
        Guid ExceptionId,
        string EntityType,
        Guid EntityId,
        string CurrentMethod,
        string RequestedMethod,
        string RequestReason,
        string Status);
}

using System.Data;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Modules.ProcurementWorkflow.Services;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/planning-committee")]
public partial class PlanningCommitteeReviewController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<PlanningCommitteeReviewController> _logger;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

    public PlanningCommitteeReviewController(
        IConfiguration config,
        ILogger<PlanningCommitteeReviewController> logger,
        WorkflowRuntimeTracker workflowRuntimeTracker)
    {
        _config = config;
        _logger = logger;
        _workflowRuntimeTracker = workflowRuntimeTracker;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    private const string ChairRoleKey = "comptroller_procurement";
    private static readonly string[] RequiredMemberRoles =
    {
        "planning_statistics_officer",
        "financial_unit_officer",
        "department_head",
        "legal_reviewer",
        "procurement_secretary"
    };
    private static readonly HashSet<string> CommitteeRoleKeys = new(
        RequiredMemberRoles.Concat(new[] { ChairRoleKey }),
        StringComparer.OrdinalIgnoreCase);

    private static readonly Dictionary<string, string> RequiredRoleLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        [ChairRoleKey] = "Comptroller Procurement (Chair)",
        ["planning_statistics_officer"] = "PSO Reviewed",
        ["financial_unit_officer"] = "Finance Reviewed",
        ["department_head"] = "Technical Reviewed",
        ["legal_reviewer"] = "Legal Reviewed",
        ["procurement_secretary"] = "Secretary Recorded"
    };

    private static readonly IReadOnlyDictionary<string, string> RoleAliases =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["comptrollerprocurement"] = ChairRoleKey,
            ["planningstatisticsofficer"] = "planning_statistics_officer",
            ["financialunitofficer"] = "financial_unit_officer",
            ["departmenthead"] = "department_head",
            ["legalreviewer"] = "legal_reviewer",
            ["procurementsecretary"] = "procurement_secretary"
        };

    [HttpGet("requisitions/{requisitionId:guid}/reviews")]
    public async Task<IActionResult> GetReviews(Guid requisitionId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("procurement_workflow.get_member_reviews_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };
            cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            await cmd.ExecuteNonQueryAsync(ct);
            var cursorName = (string)cmd.Parameters["p_result"].Value!;
            var reviews = new List<MemberReviewResponse>();
            {
                await using var fetch = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", conn, tx);
                await using var reader = await fetch.ExecuteReaderAsync(ct);

                while (await reader.ReadAsync(ct))
                {
                    reviews.Add(new MemberReviewResponse(
                        reader.GetGuid(reader.GetOrdinal("review_id")),
                        reader.GetGuid(reader.GetOrdinal("plan_id")),
                        reader.GetGuid(reader.GetOrdinal("requisition_id")),
                        reader.GetString(reader.GetOrdinal("reviewer_role")),
                        reader.GetString(reader.GetOrdinal("reviewer_user_id")),
                        reader.GetString(reader.GetOrdinal("decision")),
                        reader.IsDBNull(reader.GetOrdinal("remarks")) ? null : reader.GetString(reader.GetOrdinal("remarks")),
                        reader.GetInt32(reader.GetOrdinal("review_round")),
                        reader.GetDateTime(reader.GetOrdinal("created_at")),
                        reader.GetDateTime(reader.GetOrdinal("updated_at"))
                    ));
                }
            }

            await tx.CommitAsync(ct);
            return Ok(reviews);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving member reviews for requisition {RequisitionId}", requisitionId);
            return Problem("Internal server error retrieving reviews.");
        }
    }

    [HttpGet("plans/{planId:guid}/reviews")]
    public async Task<IActionResult> GetPlanReviews(Guid planId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            const string sql = @"
                SELECT review_id,
                       plan_id,
                       requisition_id,
                       reviewer_role,
                       reviewer_user_id,
                       decision,
                       remarks,
                       review_round,
                       created_at,
                       updated_at
                  FROM procurement_workflow.planning_committee_member_reviews
                 WHERE plan_id = @p_plan_id
                 ORDER BY review_round DESC, updated_at DESC;";
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);

            var reviews = new List<MemberReviewResponse>();
            while (await reader.ReadAsync(ct))
            {
                reviews.Add(new MemberReviewResponse(
                    reader.GetGuid(reader.GetOrdinal("review_id")),
                    reader.GetGuid(reader.GetOrdinal("plan_id")),
                    reader.GetGuid(reader.GetOrdinal("requisition_id")),
                    reader.GetString(reader.GetOrdinal("reviewer_role")),
                    reader.GetString(reader.GetOrdinal("reviewer_user_id")),
                    reader.GetString(reader.GetOrdinal("decision")),
                    reader.IsDBNull(reader.GetOrdinal("remarks")) ? null : reader.GetString(reader.GetOrdinal("remarks")),
                    reader.GetInt32(reader.GetOrdinal("review_round")),
                    reader.GetDateTime(reader.GetOrdinal("created_at")),
                    reader.GetDateTime(reader.GetOrdinal("updated_at"))
                ));
            }

            return Ok(reviews);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving member reviews for plan {PlanId}", planId);
            return Problem("Internal server error retrieving reviews.");
        }
    }

    [HttpGet("requisitions/{requisitionId:guid}/member-statuses")]
    public async Task<IActionResult> GetMemberStatuses(Guid requisitionId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("procurement_workflow.get_member_statuses_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };
            cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            await cmd.ExecuteNonQueryAsync(ct);
            var cursorName = (string)cmd.Parameters["p_result"].Value!;
            var statuses = new List<MemberStatusResponse>();
            {
                await using var fetch = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", conn, tx);
                await using var reader = await fetch.ExecuteReaderAsync(ct);

                while (await reader.ReadAsync(ct))
                {
                    statuses.Add(new MemberStatusResponse(
                        reader.GetString(reader.GetOrdinal("role_key")),
                        reader.GetString(reader.GetOrdinal("status_label")),
                        reader.IsDBNull(reader.GetOrdinal("decision")) ? null : reader.GetString(reader.GetOrdinal("decision")),
                        reader.IsDBNull(reader.GetOrdinal("updated_by")) ? null : reader.GetString(reader.GetOrdinal("updated_by")),
                        reader.GetDateTime(reader.GetOrdinal("updated_at"))
                    ));
                }
            }

            await tx.CommitAsync(ct);
            return Ok(statuses);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving member statuses for requisition {RequisitionId}", requisitionId);
            return Problem("Internal server error retrieving member statuses.");
        }
    }

    [HttpGet("plans/{planId:guid}/member-statuses")]
    public async Task<IActionResult> GetPlanMemberStatuses(Guid planId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            const string sql = @"
                WITH reqs AS (
                    SELECT DISTINCT requisition_id
                    FROM (
                        SELECT l.requisition_id
                        FROM procurement_workflow.planning_committee_plan_links l
                        WHERE l.plan_id = @p_plan_id

                        UNION ALL

                        SELECT r.requisition_id
                        FROM procurement_workflow.requisitions r
                        JOIN procurement_workflow.procurement_plan_items i
                          ON i.plan_item_id = r.app_item_id
                        WHERE i.plan_id = @p_plan_id
                    ) linked
                ),
                roles AS (
                    SELECT
                        role_key,
                        CASE role_key
                            WHEN 'planning_statistics_officer' THEN 'PSO Reviewed'
                            WHEN 'financial_unit_officer' THEN 'Finance Reviewed'
                            WHEN 'department_head' THEN 'Technical Reviewed'
                            WHEN 'legal_reviewer' THEN 'Legal Reviewed'
                            WHEN 'procurement_secretary' THEN 'Secretary Recorded'
                            ELSE role_key
                        END AS status_label
                    FROM unnest(@p_roles::text[]) AS role_key
                ),
                coverage AS (
                    SELECT
                        roles.role_key,
                        roles.status_label,
                        COUNT(DISTINCT reqs.requisition_id)::int AS total_requisitions,
                        COUNT(DISTINCT s.requisition_id) FILTER (
                            WHERE s.decision IS NOT NULL
                              AND BTRIM(s.decision) <> ''
                        )::int AS completed_requisitions,
                        MAX(s.updated_at) AS updated_at
                    FROM roles
                    CROSS JOIN reqs
                    LEFT JOIN procurement_workflow.planning_committee_member_status s
                      ON s.plan_id = @p_plan_id
                     AND s.requisition_id = reqs.requisition_id
                     AND s.role_key = roles.role_key
                    GROUP BY roles.role_key, roles.status_label
                ),
                latest AS (
                    SELECT DISTINCT ON (s.role_key)
                        s.role_key,
                        s.decision,
                        s.updated_by,
                        s.updated_at
                    FROM procurement_workflow.planning_committee_member_status s
                    WHERE s.plan_id = @p_plan_id
                      AND s.role_key = ANY(@p_roles::text[])
                    ORDER BY s.role_key, s.updated_at DESC
                )
                SELECT
                    coverage.role_key,
                    coverage.status_label,
                    CASE
                        WHEN coverage.total_requisitions = 0 THEN NULL
                        WHEN coverage.completed_requisitions < coverage.total_requisitions THEN NULL
                        ELSE latest.decision
                    END AS decision,
                    latest.updated_by,
                    COALESCE(latest.updated_at, coverage.updated_at, NOW()) AS updated_at
                FROM coverage
                LEFT JOIN latest
                  ON latest.role_key = coverage.role_key
                ORDER BY coverage.role_key ASC;";
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
            cmd.Parameters.AddWithValue("p_roles", NpgsqlDbType.Array | NpgsqlDbType.Varchar, RequiredMemberRoles);
            await using var reader = await cmd.ExecuteReaderAsync(ct);

            var statuses = new List<MemberStatusResponse>();
            while (await reader.ReadAsync(ct))
            {
                statuses.Add(new MemberStatusResponse(
                    reader.GetString(reader.GetOrdinal("role_key")),
                    reader.GetString(reader.GetOrdinal("status_label")),
                    reader.IsDBNull(reader.GetOrdinal("decision")) ? null : reader.GetString(reader.GetOrdinal("decision")),
                    reader.IsDBNull(reader.GetOrdinal("updated_by")) ? null : reader.GetString(reader.GetOrdinal("updated_by")),
                    reader.GetDateTime(reader.GetOrdinal("updated_at"))
                ));
            }

            return Ok(statuses);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving member statuses for plan {PlanId}", planId);
            return Problem("Internal server error retrieving member statuses.");
        }
    }

    [HttpGet("committee-roles")]
    public async Task<IActionResult> GetCommitteeRoles(CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            const string sql = @"
                SELECT role_name, COALESCE(description, '') AS description, is_active
                FROM identity.roles
                WHERE is_active = TRUE
                ORDER BY role_name ASC;";
            await using var cmd = new NpgsqlCommand(sql, conn);
            await using var reader = await cmd.ExecuteReaderAsync(ct);

            var results = new List<CommitteeRoleDefinitionResponse>();
            while (await reader.ReadAsync(ct))
            {
                var roleName = reader.GetString(reader.GetOrdinal("role_name"));
                var roleKey = NormalizeRoleKey(roleName);
                if (string.IsNullOrWhiteSpace(roleKey) || !CommitteeRoleKeys.Contains(roleKey))
                {
                    continue;
                }

                var description = reader.GetString(reader.GetOrdinal("description"));
                var displayName = RequiredRoleLabels.TryGetValue(roleKey, out var label)
                    ? label
                    : roleName;

                results.Add(new CommitteeRoleDefinitionResponse(
                    roleKey,
                    roleName,
                    displayName,
                    description,
                    string.Equals(roleKey, ChairRoleKey, StringComparison.OrdinalIgnoreCase)));
            }

            return Ok(results
                .OrderByDescending(role => role.IsChair)
                .ThenBy(role => role.DisplayName, StringComparer.OrdinalIgnoreCase)
                .ToList());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving planning committee role definitions.");
            return Problem("Internal server error retrieving planning committee role definitions.");
        }
    }

    [HttpGet("plan-links")]
    public async Task<IActionResult> GetPlanLinks(CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            const string sql = @"
                SELECT
                    l.requisition_id,
                    l.plan_id,
                    p.plan_title,
                    l.linked_at
                FROM procurement_workflow.planning_committee_plan_links l
                JOIN procurement_workflow.procurement_plans p
                  ON p.plan_id = l.plan_id
                ORDER BY l.linked_at DESC;";

            await using var cmd = new NpgsqlCommand(sql, conn);
            await using var reader = await cmd.ExecuteReaderAsync(ct);

            var results = new List<PlanningCommitteePlanLinkSummaryResponse>();
            while (await reader.ReadAsync(ct))
            {
                results.Add(new PlanningCommitteePlanLinkSummaryResponse(
                    reader.GetGuid(reader.GetOrdinal("requisition_id")),
                    reader.GetGuid(reader.GetOrdinal("plan_id")),
                    reader.GetString(reader.GetOrdinal("plan_title")),
                    reader.GetDateTime(reader.GetOrdinal("linked_at"))));
            }

            return Ok(results);
        }
        catch (PostgresException ex) when (ex.SqlState == "42P01")
        {
            _logger.LogWarning(ex, "Planning committee plan links table does not exist yet.");
            return Ok(Array.Empty<PlanningCommitteePlanLinkSummaryResponse>());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving planning committee plan links.");
            return Problem("Internal server error retrieving planning committee plan links.");
        }
    }

    [HttpPost("requisitions/{requisitionId:guid}/link-plan")]
    public async Task<IActionResult> LinkRequisitionToPlan(
        Guid requisitionId,
        [FromBody] PlanningCommitteePlanLinkRequest request,
        CancellationToken ct)
    {
        if (request.PlanId == Guid.Empty)
        {
            return BadRequest("PlanId is required.");
        }

        var connectionString = GetConnectionString();
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var appItemId = await GetRequisitionAppItemIdAsync(conn, tx, requisitionId, ct);
            if (appItemId.HasValue)
            {
                return BadRequest("Requisition is already part of an APP item.");
            }

            var linkedAt = await UpsertPlanLinkAsync(
                conn,
                tx,
                requisitionId,
                request.PlanId,
                User.Identity?.Name ?? string.Empty,
                ct);

            await tx.CommitAsync(ct);
            return Ok(new PlanningCommitteePlanLinkResponse(requisitionId, request.PlanId, linkedAt));
        }
        catch (PostgresException ex) when (ex.SqlState == "23503")
        {
            _logger.LogWarning(ex, "Planning committee link failed for requisition {RequisitionId}.", requisitionId);
            return BadRequest("Requisition or plan was not found.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error linking requisition {RequisitionId} to planning committee plan.", requisitionId);
            return Problem("Internal server error linking requisition to plan.");
        }
    }

    [HttpPost("requisitions/{requisitionId:guid}/unlink-plan")]
    public async Task<IActionResult> UnlinkRequisitionFromPlan(Guid requisitionId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            await RemovePlanLinkAsync(conn, tx, requisitionId, ct);

            await tx.CommitAsync(ct);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unlinking requisition {RequisitionId} from planning committee plan.", requisitionId);
            return Problem("Internal server error unlinking requisition from plan.");
        }
    }

    [HttpPost("submit-member-review")]
    public async Task<IActionResult> SubmitMemberReview([FromBody] MemberReviewSubmitRequest request, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("procurement_workflow.submit_member_review_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };
            cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, request.PlanId);
            cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, request.RequisitionId);
            cmd.Parameters.AddWithValue("p_reviewer_role", NpgsqlDbType.Varchar, request.ReviewerRole);
            cmd.Parameters.AddWithValue("p_reviewer_user_id", NpgsqlDbType.Varchar, request.ReviewerUserId);
            cmd.Parameters.AddWithValue("p_decision", NpgsqlDbType.Varchar, request.Decision);
            cmd.Parameters.AddWithValue("p_remarks", NpgsqlDbType.Text, (object?)request.Remarks ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

            await cmd.ExecuteNonQueryAsync(ct);
            var cursorName = (string)cmd.Parameters["p_result"].Value!;
            MemberReviewResponse? response = null;
            {
                await using var fetch = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", conn, tx);
                await using var reader = await fetch.ExecuteReaderAsync(ct);

                if (await reader.ReadAsync(ct))
                {
                    response = new MemberReviewResponse(
                        reader.GetGuid(reader.GetOrdinal("review_id")),
                        reader.GetGuid(reader.GetOrdinal("plan_id")),
                        reader.GetGuid(reader.GetOrdinal("requisition_id")),
                        reader.GetString(reader.GetOrdinal("reviewer_role")),
                        reader.GetString(reader.GetOrdinal("reviewer_user_id")),
                        reader.GetString(reader.GetOrdinal("decision")),
                        reader.IsDBNull(reader.GetOrdinal("remarks")) ? null : reader.GetString(reader.GetOrdinal("remarks")),
                        reader.GetInt32(reader.GetOrdinal("review_round")),
                        reader.GetDateTime(reader.GetOrdinal("created_at")),
                        reader.GetDateTime(reader.GetOrdinal("updated_at"))
                    );
                }
            }

            if (response is null)
            {
                return Problem("Failed to submit member review.");
            }

            await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest(
                "procurement_plan",
                request.PlanId,
                "planning_committee_review",
                "Submitted",
                $"Member Review: {request.Decision}",
                null,
                null,
                null,
                null,
                null,
                request.Remarks ?? "Member review submitted.",
                request.ReviewerUserId), ct);

            await tx.CommitAsync(ct);
            return Ok(response);

        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting member review for plan {PlanId}", request.PlanId);
            return Problem("Internal server error submitting review.");
        }
    }

    [HttpPost("submit-committee-decision")]
    public async Task<IActionResult> SubmitCommitteeDecision([FromBody] CommitteeDecisionSubmitRequest request, CancellationToken ct)
    {
        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        if (!string.Equals(roleKey, "comptroller_procurement", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        if (request.RequisitionId == Guid.Empty)
        {
            return BadRequest("RequisitionId is required.");
        }

        var connectionString = GetConnectionString();
        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var planId = await ResolvePlanIdForCommitteeDecisionAsync(conn, tx, request.RequisitionId, request.PlanId, ct);
            if (!planId.HasValue)
            {
                return BadRequest("Requisition is not linked to a committee plan.");
            }

            var pendingRoles = await GetPendingMemberRolesAsync(conn, tx, request.RequisitionId, ct);
            if (pendingRoles.Count > 0)
            {
                var pendingLabels = pendingRoles
                    .Select(role => RequiredRoleLabels.TryGetValue(role, out var label) ? label : role)
                    .ToList();
                return BadRequest($"Final decision cannot be submitted while pending: {string.Join(", ", pendingLabels)}.");
            }

            if (string.Equals(request.OverallDecision, "Recommended", StringComparison.OrdinalIgnoreCase))
            {
                await CreateAppItemForRequisitionAsync(conn, tx, planId.Value, request.RequisitionId, ct);
            }

            var response = await UpsertCommitteeDecisionAsync(conn, tx, request.RequisitionId, planId.Value, request, ct);

            if (response is null)
            {
                return Problem("Failed to submit committee decision.");
            }

            string nextStage = request.OverallDecision switch
            {
                "Recommended" => "app_approval",
                "ReturnedToDepartment" => "department_head_endorsement",
                _ => "app_approval"
            };

            await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest(
                "procurement_plan",
                planId.Value,
                nextStage,
                request.OverallDecision == "Recommended" ? "Submitted" : request.OverallDecision == "ReturnedToDepartment" ? "Draft" : "Rejected",
                $"Committee Decision: {request.OverallDecision}",
                null,
                null,
                null,
                null,
                null,
                request.CommitteeRemarks ?? "Committee decision recorded.",
                request.ChairmanUserId), ct);

            if (string.Equals(request.OverallDecision, "Recommended", StringComparison.OrdinalIgnoreCase))
            {
                await RemovePlanLinkAsync(conn, tx, request.RequisitionId, ct);
            }

            await tx.CommitAsync(ct);
            return Ok(response);

        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting committee decision for requisition {RequisitionId}", request.RequisitionId);
            return Problem("Internal server error submitting decision.");
        }
    }

    private static async Task<List<string>> GetPendingMemberRolesAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid requisitionId,
        CancellationToken ct)
    {
        const string sql = @"
            WITH roles AS (
                SELECT unnest(@p_roles)::text AS role_key
            ),
            missing AS (
                SELECT @p_requisition_id AS requisition_id, roles.role_key
                FROM roles
                LEFT JOIN procurement_workflow.planning_committee_member_status s
                  ON s.requisition_id = @p_requisition_id
                 AND s.role_key = roles.role_key
                 AND s.decision IS NOT NULL
                 AND s.decision <> ''
                WHERE s.role_key IS NULL
            )
            SELECT DISTINCT role_key
            FROM missing;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        cmd.Parameters.AddWithValue("p_roles", NpgsqlDbType.Array | NpgsqlDbType.Varchar, RequiredMemberRoles);

        var pending = new List<string>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            pending.Add(reader.GetString(reader.GetOrdinal("role_key")));
        }

        return pending;
    }

    private static async Task<Guid?> GetRequisitionAppItemIdAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid requisitionId,
        CancellationToken ct)
    {
        const string sql = @"
            SELECT app_item_id
            FROM procurement_workflow.requisitions
            WHERE requisition_id = @p_requisition_id;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is null || result is DBNull ? null : (Guid?)result;
    }

    private static async Task<DateTime> UpsertPlanLinkAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid requisitionId,
        Guid planId,
        string linkedBy,
        CancellationToken ct)
    {
        const string sql = @"
            INSERT INTO procurement_workflow.planning_committee_plan_links (
                requisition_id,
                plan_id,
                linked_by,
                linked_at
            )
            VALUES (
                @p_requisition_id,
                @p_plan_id,
                NULLIF(@p_linked_by, ''),
                NOW()
            )
            ON CONFLICT (requisition_id) DO UPDATE
            SET
                plan_id = EXCLUDED.plan_id,
                linked_by = EXCLUDED.linked_by,
                linked_at = NOW()
            RETURNING linked_at;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        cmd.Parameters.AddWithValue("p_linked_by", NpgsqlDbType.Varchar, linkedBy ?? string.Empty);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is DateTime linkedAt ? linkedAt : DateTime.UtcNow;
    }

    private static async Task RemovePlanLinkAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid requisitionId,
        CancellationToken ct)
    {
        const string sql = @"
            DELETE FROM procurement_workflow.planning_committee_plan_links
            WHERE requisition_id = @p_requisition_id;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task<Guid?> ResolvePlanIdForCommitteeDecisionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid requisitionId,
        Guid requestedPlanId,
        CancellationToken ct)
    {
        const string sql = @"
            SELECT plan_id
            FROM procurement_workflow.planning_committee_plan_links
            WHERE requisition_id = @p_requisition_id

            UNION

            SELECT i.plan_id
            FROM procurement_workflow.requisitions r
            JOIN procurement_workflow.procurement_plan_items i
              ON i.plan_item_id = r.app_item_id
            WHERE r.requisition_id = @p_requisition_id
            LIMIT 1;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        var result = await cmd.ExecuteScalarAsync(ct);
        var resolvedPlanId = result is null || result is DBNull ? (Guid?)null : (Guid?)result;

        if (resolvedPlanId.HasValue && requestedPlanId != Guid.Empty && requestedPlanId != resolvedPlanId.Value)
        {
            throw new InvalidOperationException("Requisition is not linked to the selected committee plan.");
        }

        return resolvedPlanId;
    }

    private static async Task<CommitteeDecisionResponse?> UpsertCommitteeDecisionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid requisitionId,
        Guid planId,
        CommitteeDecisionSubmitRequest request,
        CancellationToken ct)
    {
        const string sql = @"
            INSERT INTO procurement_workflow.planning_committee_decisions (
                requisition_id,
                plan_id,
                chairman_user_id,
                secretary_user_id,
                overall_decision,
                committee_remarks,
                meeting_date
            )
            VALUES (
                @p_requisition_id,
                @p_plan_id,
                @p_chairman_user_id,
                @p_secretary_user_id,
                @p_overall_decision,
                @p_committee_remarks,
                COALESCE(@p_meeting_date, CURRENT_DATE)
            )
            ON CONFLICT (requisition_id) DO UPDATE
            SET
                plan_id = EXCLUDED.plan_id,
                chairman_user_id = EXCLUDED.chairman_user_id,
                secretary_user_id = EXCLUDED.secretary_user_id,
                overall_decision = EXCLUDED.overall_decision,
                committee_remarks = EXCLUDED.committee_remarks,
                meeting_date = EXCLUDED.meeting_date,
                updated_at = NOW()
            RETURNING
                decision_id,
                requisition_id,
                plan_id,
                overall_decision,
                committee_remarks,
                meeting_date,
                created_at;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        cmd.Parameters.AddWithValue("p_chairman_user_id", NpgsqlDbType.Varchar, request.ChairmanUserId);
        cmd.Parameters.AddWithValue("p_secretary_user_id", NpgsqlDbType.Varchar, request.SecretaryUserId);
        cmd.Parameters.AddWithValue("p_overall_decision", NpgsqlDbType.Varchar, request.OverallDecision);
        cmd.Parameters.AddWithValue("p_committee_remarks", NpgsqlDbType.Text, (object?)request.CommitteeRemarks ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_meeting_date", NpgsqlDbType.Date, (object?)request.MeetingDate ?? DBNull.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new CommitteeDecisionResponse(
            reader.GetGuid(reader.GetOrdinal("decision_id")),
            reader.GetGuid(reader.GetOrdinal("requisition_id")),
            reader.GetGuid(reader.GetOrdinal("plan_id")),
            reader.GetString(reader.GetOrdinal("overall_decision")),
            reader.IsDBNull(reader.GetOrdinal("committee_remarks")) ? null : reader.GetString(reader.GetOrdinal("committee_remarks")),
            reader.GetDateTime(reader.GetOrdinal("meeting_date")),
            reader.GetDateTime(reader.GetOrdinal("created_at")));
    }

    private sealed record LinkedRequisitionContext(
        Guid RequisitionId,
        string Title,
        string BudgetCode,
        string? ProcurementType,
        decimal TotalEstimate,
        Guid? AppItemId);

    private static async Task<List<LinkedRequisitionContext>> GetLinkedPlanRequisitionsAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid planId,
        CancellationToken ct)
    {
        const string sql = @"
            SELECT
                r.requisition_id,
                r.title,
                r.budget_code,
                r.procurement_type,
                r.total_estimate,
                r.app_item_id
            FROM procurement_workflow.planning_committee_plan_links l
            JOIN procurement_workflow.requisitions r
              ON r.requisition_id = l.requisition_id
            WHERE l.plan_id = @p_plan_id
            ORDER BY r.created_at ASC;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);

        var requisitions = new List<LinkedRequisitionContext>();
        while (await reader.ReadAsync(ct))
        {
            requisitions.Add(new LinkedRequisitionContext(
                reader.GetGuid(reader.GetOrdinal("requisition_id")),
                reader.GetString(reader.GetOrdinal("title")),
                reader.GetString(reader.GetOrdinal("budget_code")),
                reader.IsDBNull(reader.GetOrdinal("procurement_type")) ? null : reader.GetString(reader.GetOrdinal("procurement_type")),
                reader.GetFieldValue<decimal>(reader.GetOrdinal("total_estimate")),
                reader.IsDBNull(reader.GetOrdinal("app_item_id")) ? null : reader.GetGuid(reader.GetOrdinal("app_item_id"))));
        }

        return requisitions;
    }

    private static async Task CreateAppItemForRequisitionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid planId,
        Guid requisitionId,
        CancellationToken ct)
    {
        var linkedRequisitions = await GetLinkedPlanRequisitionsAsync(conn, tx, planId, ct);
        var requisition = linkedRequisitions.FirstOrDefault(item => item.RequisitionId == requisitionId);
        if (requisition is null)
        {
            throw new InvalidOperationException("Requisition is not linked to the selected committee plan.");
        }

        if (requisition.AppItemId.HasValue)
        {
            return;
        }

        await using var createItemCmd = new NpgsqlCommand("procurement_workflow.create_procurement_plan_item_sp", conn, tx)
        {
            CommandType = CommandType.StoredProcedure
        };
        createItemCmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        createItemCmd.Parameters.AddWithValue("p_item_code", NpgsqlDbType.Varchar, DBNull.Value);
        createItemCmd.Parameters.AddWithValue("p_description", NpgsqlDbType.Text, requisition.Title);
        createItemCmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, requisition.BudgetCode);
        createItemCmd.Parameters.AddWithValue("p_procurement_type", NpgsqlDbType.Varchar, (object?)requisition.ProcurementType ?? DBNull.Value);
        createItemCmd.Parameters.AddWithValue("p_estimated_amount", NpgsqlDbType.Numeric, requisition.TotalEstimate);
        createItemCmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, "Active");
        createItemCmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, "Created after finalized planning committee review.");
        createItemCmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

        await createItemCmd.ExecuteNonQueryAsync(ct);
        var cursorName = (string)createItemCmd.Parameters["p_result"].Value!;

        Guid? planItemId = null;
        await using (var fetch = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", conn, tx))
        await using (var reader = await fetch.ExecuteReaderAsync(ct))
        {
            if (await reader.ReadAsync(ct))
            {
                planItemId = reader.GetGuid(reader.GetOrdinal("plan_item_id"));
            }
        }

        if (!planItemId.HasValue)
        {
            throw new InvalidOperationException($"Unable to create APP item for requisition {requisition.RequisitionId}.");
        }

        const string updateSql = @"
            UPDATE procurement_workflow.requisitions
            SET app_item_id = @p_app_item_id,
                updated_at = NOW()
            WHERE requisition_id = @p_requisition_id;";

        await using var updateReqCmd = new NpgsqlCommand(updateSql, conn, tx);
        updateReqCmd.Parameters.AddWithValue("p_app_item_id", NpgsqlDbType.Uuid, planItemId.Value);
        updateReqCmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisition.RequisitionId);
        await updateReqCmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task ClearCommitteePlanLinksAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid planId,
        CancellationToken ct)
    {
        const string sql = @"
            DELETE FROM procurement_workflow.planning_committee_plan_links
            WHERE plan_id = @p_plan_id;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static string? NormalizeRoleKey(string? role)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            return null;
        }

        var trimmed = role.Trim();
        var withUnderscores = trimmed.Replace("-", "_").Replace(" ", "_");
        var snakeCase = Regex.Replace(withUnderscores, "([a-z0-9])([A-Z])", "$1_$2");
        var normalized = snakeCase.ToLowerInvariant();

        return RoleAliases.TryGetValue(normalized, out var alias)
            ? alias
            : normalized;
    }
}

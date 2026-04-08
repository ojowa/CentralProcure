using System.Data;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Services;

public class EvaluationService : IEvaluationService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EvaluationService> _logger;
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private readonly WorkflowActionGrantService _workflowActionGrantService;

    public EvaluationService(
        IConfiguration config,
        ILogger<EvaluationService> logger,
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

    public async Task<List<AssignedTenderItem>> GetAssignedTendersAsync(string? roleKey, Guid? internalUserId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(roleKey)) return new List<AssignedTenderItem>();

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await TenderEvaluationAssignmentRegistry.EnsureTableAsync(conn, null, ct);

        const string sql = @"
            SELECT r.report_code, r.tender_id, r.tender_title, r.committee_lead, COALESCE(user_assignment.assignment_role, @p_role_key) AS assignment_role, r.status AS evaluation_status, r.submitted_at, t.category AS procurement_category, t.status AS tender_status, t.closing_date, t.opening_date,
                   CASE WHEN to_regclass('procurement_workflow.evaluation_actions') IS NULL THEN FALSE ELSE EXISTS (SELECT 1 FROM procurement_workflow.evaluation_actions a WHERE a.tender_id = r.tender_id AND a.action_type = 'ConflictOfInterest') END AS is_locked
            FROM procurement_workflow.evaluation_reports r
            LEFT JOIN vendor_sourcing.tenders t ON t.tender_id = r.tender_id
            LEFT JOIN LATERAL (SELECT COUNT(*)::int AS assignment_count FROM procurement_workflow.tender_evaluation_assignments tea WHERE tea.tender_id = r.tender_id) assignment_meta ON TRUE
            LEFT JOIN LATERAL (SELECT tea.assignment_role FROM procurement_workflow.tender_evaluation_assignments tea WHERE tea.tender_id = r.tender_id AND @p_internal_user_id IS NOT NULL AND tea.internal_user_id = @p_internal_user_id LIMIT 1) user_assignment ON TRUE
            WHERE (assignment_meta.assignment_count > 0 AND @p_internal_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM procurement_workflow.tender_evaluation_assignments tea WHERE tea.tender_id = r.tender_id AND tea.internal_user_id = @p_internal_user_id))
               OR (assignment_meta.assignment_count = 0 AND EXISTS (SELECT 1 FROM procurement_workflow.workflow_instances wi JOIN procurement_workflow.workflow_role_tasks wrt ON wrt.stage_key = wi.current_stage_key WHERE wi.entity_type = 'tender' AND wi.entity_id = r.tender_id AND wrt.role_key = @p_role_key))
            ORDER BY r.submitted_at DESC;";

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_role_key", NpgsqlDbType.Varchar, roleKey);
        cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, (object?)internalUserId ?? DBNull.Value);

        var results = new List<AssignedTenderItem>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(new AssignedTenderItem(
                reader.GetString(reader.GetOrdinal("report_code")), reader.GetGuid(reader.GetOrdinal("tender_id")), reader.GetString(reader.GetOrdinal("tender_title")), reader.GetString(reader.GetOrdinal("committee_lead")),
                reader.GetString(reader.GetOrdinal("assignment_role")), reader.GetString(reader.GetOrdinal("evaluation_status")), reader.IsDBNull(reader.GetOrdinal("tender_status")) ? "Unknown" : reader.GetString(reader.GetOrdinal("tender_status")),
                reader.IsDBNull(reader.GetOrdinal("procurement_category")) ? "Unspecified" : reader.GetString(reader.GetOrdinal("procurement_category")), reader.IsDBNull(reader.GetOrdinal("closing_date")) ? null : reader.GetDateTime(reader.GetOrdinal("closing_date")),
                reader.IsDBNull(reader.GetOrdinal("opening_date")) ? null : reader.GetDateTime(reader.GetOrdinal("opening_date")), reader.GetDateTime(reader.GetOrdinal("submitted_at")), reader.GetBoolean(reader.GetOrdinal("is_locked"))));
        }
        return results;
    }

    public async Task<Guid?> LogEvaluationActionAsync(EvaluationActionRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var actionType = ValidateAndNormalizeActionType(request.ActionType);
        ValidateActionPayload(actionType, request);

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var actor = request.RequestedBy?.Trim() ?? ResolveActor(user);
        var workflowMovement = ResolveWorkflowMovement(actionType);
        WorkflowInstanceState? currentTenderWorkflow = null;

        if (workflowMovement is not null)
        {
            if (!await _workflowActionGrantService.HasRequiredActionAsync(conn, tx, user, "tender", request.TenderId, "evaluation.actions", ct))
                throw new UnauthorizedAccessException();

            currentTenderWorkflow = await GetWorkflowInstanceAsync(conn, tx, "tender", request.TenderId, ct) ?? throw new KeyNotFoundException("Tender workflow record not found.");
            var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(conn, tx, "tender", request.TenderId, workflowMovement.StageKey, ct);
            if (!transition.IsAllowed) throw new InvalidOperationException(transition.Message);
        }

        const string sql = @"
            INSERT INTO procurement_workflow.evaluation_actions (action_type, report_code, tender_id, notes, reason, justification, recommendation, threshold_note, requested_by)
            VALUES (@action_type, @report_code, @tender_id, @notes, @reason, @justification, @recommendation, @threshold_note, @requested_by)
            RETURNING action_id;";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("action_type", NpgsqlDbType.Varchar, actionType);
        cmd.Parameters.AddWithValue("report_code", (object?)request.ReportCode ?? DBNull.Value);
        cmd.Parameters.AddWithValue("tender_id", request.TenderId);
        cmd.Parameters.AddWithValue("notes", (object?)request.Notes ?? DBNull.Value);
        cmd.Parameters.AddWithValue("reason", (object?)request.Reason ?? DBNull.Value);
        cmd.Parameters.AddWithValue("justification", (object?)request.Justification ?? DBNull.Value);
        cmd.Parameters.AddWithValue("recommendation", (object?)request.Recommendation ?? DBNull.Value);
        cmd.Parameters.AddWithValue("threshold_note", (object?)request.ThresholdNote ?? DBNull.Value);
        cmd.Parameters.AddWithValue("requested_by", (object?)actor ?? DBNull.Value);

        var actionId = (Guid?)await cmd.ExecuteScalarAsync(ct);

        if (workflowMovement is not null && currentTenderWorkflow is not null)
        {
            await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest(currentTenderWorkflow.EntityType, currentTenderWorkflow.EntityId, workflowMovement.StageKey, currentTenderWorkflow.CurrentStatus, currentTenderWorkflow.RecordTitle, currentTenderWorkflow.ParentEntityType, currentTenderWorkflow.ParentEntityId, currentTenderWorkflow.Amount, currentTenderWorkflow.ProcurementType, currentTenderWorkflow.ThresholdId, workflowMovement.Reason, actor, "evaluation_action"), ct);
        }

        await tx.CommitAsync(ct);
        return actionId;
    }

    private static string ValidateAndNormalizeActionType(string? actionType)
    {
        var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "RequestClarification", "RecordNonCompliance", "ConflictOfInterest", "RecommendAward", "RecommendReTender", "EscalateToBoard", "StartEvaluation" };
        var normalized = actionType?.Trim();
        if (string.IsNullOrWhiteSpace(normalized) || !allowed.Contains(normalized)) throw new ArgumentException("Unsupported or missing ActionType.");
        return allowed.First(v => string.Equals(v, normalized, StringComparison.OrdinalIgnoreCase));
    }

    private static void ValidateActionPayload(string actionType, EvaluationActionRequest req)
    {
        if (actionType is "RecordNonCompliance" or "ConflictOfInterest" && string.IsNullOrWhiteSpace(req.Reason)) throw new ArgumentException("Reason is required.");
        if (actionType is "RequestClarification" && string.IsNullOrWhiteSpace(req.Notes)) throw new ArgumentException("Clarification notes are required.");
        if (actionType is "RecommendAward" or "RecommendReTender" && string.IsNullOrWhiteSpace(req.Justification)) throw new ArgumentException("Justification is required.");
        if (actionType is "EscalateToBoard" && string.IsNullOrWhiteSpace(req.ThresholdNote)) throw new ArgumentException("Threshold note is required.");
    }

    private static WorkflowMovement? ResolveWorkflowMovement(string actionType) => actionType switch { "StartEvaluation" => new WorkflowMovement("evaluation", "Evaluation started from bid opening."), "EscalateToBoard" => new WorkflowMovement("tenders_board_review", "Evaluation escalated to Tenders Board review."), "RecommendAward" => new WorkflowMovement("tenders_board_review", "Evaluation recommendation submitted for Tenders Board review."), _ => null };
    private static string? ResolveActor(ClaimsPrincipal user) => user.FindFirstValue(ClaimTypes.Email) ?? user.FindFirstValue(ClaimTypes.Name) ?? user.Identity?.Name;

    private static async Task<WorkflowInstanceState?> GetWorkflowInstanceAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string type, Guid id, CancellationToken ct)
    {
        const string sql = "SELECT entity_type, entity_id, current_stage_key, current_status, record_title, parent_entity_type, parent_entity_id, amount, procurement_type, threshold_id FROM procurement_workflow.workflow_instances WHERE entity_type = @p_type AND entity_id = @p_id FOR UPDATE;";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_type", type); cmd.Parameters.AddWithValue("p_id", id);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;
        return new WorkflowInstanceState(r.GetString(0), r.GetGuid(1), r.GetString(2), r.IsDBNull(3) ? null : r.GetString(3), r.IsDBNull(4) ? null : r.GetString(4), r.IsDBNull(5) ? null : r.GetString(5), r.IsDBNull(6) ? null : r.GetGuid(6), r.IsDBNull(7) ? null : r.GetFieldValue<decimal>(7), r.IsDBNull(8) ? null : r.GetString(8), r.IsDBNull(9) ? null : r.GetGuid(9));
    }

    private sealed record WorkflowMovement(string StageKey, string Reason);
    private sealed record WorkflowInstanceState(string EntityType, Guid EntityId, string CurrentStageKey, string? CurrentStatus, string? RecordTitle, string? ParentEntityType, Guid? ParentEntityId, decimal? Amount, string? ProcurementType, Guid? ThresholdId);
}

using System.Data;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Modules.ProcurementWorkflow.Services;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class PlanningCommitteeWorkspaceController
{
    private async Task<CommitteeDecisionResponse> FinalizeReviewAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid requisitionId, string? roleKey, Guid? currentUserId, string actor, PlanningCommitteeFinalizeReviewRequest request, CancellationToken ct)
    {
        var isChair = string.Equals(roleKey, ChairRoleKey, StringComparison.OrdinalIgnoreCase);
        var isAdmin = string.Equals(roleKey, AdminRoleKey, StringComparison.OrdinalIgnoreCase);
        var assignedChairmanId = await PlanningCommitteeChairmanRegistry.GetAssignedChairmanUserIdAsync(conn, tx, ct);
        var isAssignedChairman = currentUserId.HasValue && assignedChairmanId == currentUserId.Value;
        if (!isChair && !isAdmin && !isAssignedChairman)
        {
            throw new UnauthorizedAccessException();
        }

        var planId = await ResolvePlanIdAsync(conn, tx, requisitionId, ct)
            ?? throw new InvalidOperationException("Requisition is not linked to a committee plan.");
        var pendingRoles = await GetPendingMemberRolesAsync(conn, tx, requisitionId, ct);
        if (pendingRoles.Count > 0)
        {
            throw new InvalidOperationException($"Final decision cannot be submitted while pending: {string.Join(", ", pendingRoles)}.");
        }

        if (string.Equals(request.OverallDecision, "Recommended", StringComparison.OrdinalIgnoreCase))
        {
            await CreateAppItemForRequisitionAsync(conn, tx, planId, requisitionId, ct);
        }

        await UpdateRequisitionStatusForFinalDecisionAsync(conn, tx, requisitionId, request.OverallDecision, ct);

        var chairmanIdentity = currentUserId?.ToString() ?? actor;
        var response = await UpsertCommitteeDecisionAsync(conn, tx, requisitionId, planId, chairmanIdentity, actor, request, ct)
            ?? throw new InvalidOperationException("Failed to submit committee decision.");
        var nextStage = request.OverallDecision switch
        {
            "Recommended" => "planning_committee_review",
            "ReturnedToDepartment" => "department_head_endorsement",
            _ => "planning_committee_review"
        };
        var workflowStatus = request.OverallDecision switch
        {
            "Recommended" => "Under Review",
            "ReturnedToDepartment" => "Draft",
            _ => "Rejected"
        };
        var transitionReason = request.OverallDecision switch
        {
            "Recommended" => "Committee finalized requisition, created APP item, and approved the requisition into the departmental plan.",
            "ReturnedToDepartment" => request.CommitteeRemarks ?? "Committee returned requisition to department for correction.",
            _ => request.CommitteeRemarks ?? "Committee rejected requisition."
        };

        await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest(
            "procurement_plan",
            planId,
            nextStage,
            workflowStatus,
            $"Committee Decision: {request.OverallDecision}",
            null,
            null,
            null,
            null,
            null,
            transitionReason,
            chairmanIdentity), ct);

        if (string.Equals(request.OverallDecision, "Recommended", StringComparison.OrdinalIgnoreCase))
        {
            await RemovePlanLinkAsync(conn, tx, requisitionId, ct);
        }

        return response;
    }

    private static async Task<Guid?> ResolvePlanIdAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid requisitionId, CancellationToken ct)
    {
        const string sql = """
SELECT plan_id FROM procurement_workflow.planning_committee_plan_links WHERE requisition_id = @p_requisition_id
UNION
SELECT i.plan_id
FROM procurement_workflow.requisitions r
JOIN procurement_workflow.procurement_plan_items i ON i.plan_item_id = r.app_item_id
WHERE r.requisition_id = @p_requisition_id
LIMIT 1;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is null || result is DBNull ? null : (Guid?)result;
    }

    private static async Task<List<string>> GetPendingMemberRolesAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid requisitionId, CancellationToken ct)
    {
        const string sql = """
WITH roles AS (SELECT unnest(@p_roles)::text AS role_key)
SELECT roles.role_key
FROM roles
LEFT JOIN procurement_workflow.planning_committee_member_status s
  ON s.requisition_id = @p_requisition_id
 AND s.role_key = roles.role_key
 AND s.decision IS NOT NULL
 AND s.decision <> ''
WHERE s.role_key IS NULL;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        cmd.Parameters.AddWithValue("p_roles", NpgsqlDbType.Array | NpgsqlDbType.Text, MemberRoleKeys);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<string>();
        while (await reader.ReadAsync(ct))
        {
            var role = reader.GetString(reader.GetOrdinal("role_key"));
            results.Add(PendingRoleLabels.TryGetValue(role, out var label) ? label : role);
        }

        return results;
    }

    private static async Task<CommitteeDecisionResponse?> UpsertCommitteeDecisionAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid requisitionId, Guid planId, string chairmanIdentity, string secretaryIdentity, PlanningCommitteeFinalizeReviewRequest request, CancellationToken ct)
    {
        const string sql = """
INSERT INTO procurement_workflow.planning_committee_decisions (requisition_id, plan_id, chairman_user_id, secretary_user_id, overall_decision, committee_remarks, meeting_date)
VALUES (@p_requisition_id, @p_plan_id, @p_chairman_user_id, @p_secretary_user_id, @p_overall_decision, @p_committee_remarks, CURRENT_DATE)
ON CONFLICT (requisition_id) DO UPDATE
SET plan_id = EXCLUDED.plan_id,
    chairman_user_id = EXCLUDED.chairman_user_id,
    secretary_user_id = EXCLUDED.secretary_user_id,
    overall_decision = EXCLUDED.overall_decision,
    committee_remarks = EXCLUDED.committee_remarks,
    meeting_date = EXCLUDED.meeting_date,
    updated_at = NOW()
RETURNING decision_id, requisition_id, plan_id, overall_decision, committee_remarks, meeting_date, created_at;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        cmd.Parameters.AddWithValue("p_chairman_user_id", NpgsqlDbType.Varchar, chairmanIdentity);
        cmd.Parameters.AddWithValue("p_secretary_user_id", NpgsqlDbType.Varchar, secretaryIdentity);
        cmd.Parameters.AddWithValue("p_overall_decision", NpgsqlDbType.Varchar, request.OverallDecision);
        cmd.Parameters.AddWithValue("p_committee_remarks", NpgsqlDbType.Text, (object?)request.CommitteeRemarks ?? DBNull.Value);
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
            GetNullableString(reader, "committee_remarks"),
            reader.GetDateTime(reader.GetOrdinal("meeting_date")),
            reader.GetDateTime(reader.GetOrdinal("created_at")));
    }

    private static async Task CreateAppItemForRequisitionAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid planId, Guid requisitionId, CancellationToken ct)
    {
        var context = await GetLinkContextAsync(conn, tx, requisitionId, ct)
            ?? throw new InvalidOperationException("Requisition was not found.");
        if (context.AppItemId.HasValue)
        {
            return;
        }

        await using var createItemCmd = new NpgsqlCommand("procurement_workflow.create_procurement_plan_item_sp", conn, tx)
        {
            CommandType = CommandType.StoredProcedure
        };
        createItemCmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        createItemCmd.Parameters.AddWithValue("p_item_code", NpgsqlDbType.Varchar, DBNull.Value);
        createItemCmd.Parameters.AddWithValue("p_description", NpgsqlDbType.Text, context.Title);
        createItemCmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, context.BudgetCode ?? string.Empty);
        createItemCmd.Parameters.AddWithValue("p_procurement_type", NpgsqlDbType.Varchar, (object?)context.ProcurementType ?? DBNull.Value);
        createItemCmd.Parameters.AddWithValue("p_estimated_amount", NpgsqlDbType.Numeric, context.TotalEstimate);
        createItemCmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, "Active");
        createItemCmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, "Created after finalized planning committee review.");
        createItemCmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

        var createdItem = (await ExecuteRefcursorAsync(createItemCmd, reader => reader.GetGuid(reader.GetOrdinal("plan_item_id")), ct)).FirstOrDefault();
        if (createdItem == Guid.Empty)
        {
            throw new InvalidOperationException("Unable to create APP item for requisition.");
        }

        const string updateSql = """
UPDATE procurement_workflow.requisitions
SET app_item_id = @p_app_item_id,
    updated_at = NOW()
WHERE requisition_id = @p_requisition_id;
""";
        await using var updateReqCmd = new NpgsqlCommand(updateSql, conn, tx);
        updateReqCmd.Parameters.AddWithValue("p_app_item_id", NpgsqlDbType.Uuid, createdItem);
        updateReqCmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        await updateReqCmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task UpdateRequisitionStatusForFinalDecisionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid requisitionId,
        string overallDecision,
        CancellationToken ct)
    {
        var nextStatus = overallDecision switch
        {
            "Recommended" => "Approved",
            "ReturnedToDepartment" => "Draft",
            _ => "Rejected"
        };

        const string sql = """
UPDATE procurement_workflow.requisitions
SET status = @p_status,
    updated_at = NOW()
WHERE requisition_id = @p_requisition_id;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, nextStatus);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}

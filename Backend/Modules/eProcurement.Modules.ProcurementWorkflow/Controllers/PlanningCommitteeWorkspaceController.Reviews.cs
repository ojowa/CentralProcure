using System.Data;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class PlanningCommitteeWorkspaceController
{
    private static readonly Dictionary<string, string> PendingRoleLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["planning_statistics_officer"] = "PSO Reviewed",
        ["financial_unit_officer"] = "Finance Reviewed",
        ["department_head"] = "Technical Reviewed",
        ["legal_reviewer"] = "Legal Reviewed",
        ["procurement_secretary"] = "Secretary Recorded"
    };

    private static async Task<List<MemberReviewResponse>> GetMemberReviewsAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid requisitionId, CancellationToken ct)
    {
        const string sql = """
SELECT review_id, plan_id, requisition_id, reviewer_role, reviewer_user_id, decision, remarks, created_at, updated_at
FROM procurement_workflow.planning_committee_member_reviews
WHERE requisition_id = @p_requisition_id
ORDER BY updated_at DESC;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<MemberReviewResponse>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(new MemberReviewResponse(
                reader.GetGuid(reader.GetOrdinal("review_id")),
                reader.GetGuid(reader.GetOrdinal("plan_id")),
                reader.GetGuid(reader.GetOrdinal("requisition_id")),
                reader.GetString(reader.GetOrdinal("reviewer_role")),
                reader.GetString(reader.GetOrdinal("reviewer_user_id")),
                reader.GetString(reader.GetOrdinal("decision")),
                GetNullableString(reader, "remarks"),
                reader.GetDateTime(reader.GetOrdinal("created_at")),
                reader.GetDateTime(reader.GetOrdinal("updated_at"))));
        }

        return results;
    }

    private static async Task<List<MemberStatusResponse>> GetMemberStatusesAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid requisitionId, CancellationToken ct)
    {
        const string sql = """
SELECT role_key, status_label, decision, updated_by, updated_at
FROM procurement_workflow.planning_committee_member_status
WHERE requisition_id = @p_requisition_id
ORDER BY updated_at DESC;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<MemberStatusResponse>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(new MemberStatusResponse(
                reader.GetString(reader.GetOrdinal("role_key")),
                reader.GetString(reader.GetOrdinal("status_label")),
                GetNullableString(reader, "decision"),
                GetNullableString(reader, "updated_by"),
                reader.GetDateTime(reader.GetOrdinal("updated_at"))));
        }

        return results;
    }

    private static async Task<CommitteeDecisionResponse?> GetDecisionAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid requisitionId, CancellationToken ct)
    {
        const string sql = """
SELECT decision_id, requisition_id, plan_id, overall_decision, committee_remarks, meeting_date, created_at
FROM procurement_workflow.planning_committee_decisions
WHERE requisition_id = @p_requisition_id;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
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

    private static async Task RemovePlanLinkAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid requisitionId, CancellationToken ct)
    {
        const string sql = "DELETE FROM procurement_workflow.planning_committee_plan_links WHERE requisition_id = @p_requisition_id;";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task<Guid?> GetAppItemIdAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid requisitionId, CancellationToken ct)
    {
        const string sql = "SELECT app_item_id FROM procurement_workflow.requisitions WHERE requisition_id = @p_requisition_id;";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is null || result is DBNull ? null : (Guid?)result;
    }

    private async Task UnlinkRequisitionAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid requisitionId, string? roleKey, string actor, string? reason, CancellationToken ct)
    {
        if (roleKey is not ("financial_unit_officer" or "admin"))
        {
            throw new UnauthorizedAccessException();
        }

        var appItemId = await GetAppItemIdAsync(conn, tx, requisitionId, ct);
        if (appItemId.HasValue)
        {
            if (string.IsNullOrWhiteSpace(reason))
            {
                throw new InvalidOperationException("Provide a reason before unlinking this APP item.");
            }

            await using var cmd = new NpgsqlCommand("procurement_workflow.unlink_requisition_app_item_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };
            cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
            cmd.Parameters.AddWithValue("p_reason", NpgsqlDbType.Text, reason.Trim());
            cmd.Parameters.AddWithValue("p_unlinked_by", NpgsqlDbType.Varchar, actor);
            await cmd.ExecuteNonQueryAsync(ct);
            return;
        }

        var workspace = await GetRequisitionSummaryAsync(conn, tx, requisitionId, ct);
        if (workspace?.CommitteePlanId is null)
        {
            throw new InvalidOperationException("This requisition is not linked to a committee plan.");
        }

        await RemovePlanLinkAsync(conn, tx, requisitionId, ct);
    }

    private async Task<MemberReviewResponse> SubmitMemberReviewAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid requisitionId, string? roleKey, string actor, PlanningCommitteeMemberReviewActionRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(roleKey) || !MemberRoleKeys.Contains(roleKey, StringComparer.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException();
        }

        var planId = await ResolvePlanIdAsync(conn, tx, requisitionId, ct)
            ?? throw new InvalidOperationException("Requisition is not linked to a committee plan.");

        await using var cmd = new NpgsqlCommand("procurement_workflow.submit_member_review_sp", conn, tx)
        {
            CommandType = CommandType.StoredProcedure
        };
        cmd.Parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        cmd.Parameters.AddWithValue("p_reviewer_role", NpgsqlDbType.Varchar, roleKey);
        cmd.Parameters.AddWithValue("p_reviewer_user_id", NpgsqlDbType.Varchar, actor);
        cmd.Parameters.AddWithValue("p_decision", NpgsqlDbType.Varchar, request.Decision);
        cmd.Parameters.AddWithValue("p_remarks", NpgsqlDbType.Text, (object?)request.Remarks ?? DBNull.Value);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

        var review = (await ExecuteRefcursorAsync(cmd, reader => new MemberReviewResponse(
            reader.GetGuid(reader.GetOrdinal("review_id")),
            reader.GetGuid(reader.GetOrdinal("plan_id")),
            reader.GetGuid(reader.GetOrdinal("requisition_id")),
            reader.GetString(reader.GetOrdinal("reviewer_role")),
            reader.GetString(reader.GetOrdinal("reviewer_user_id")),
            reader.GetString(reader.GetOrdinal("decision")),
            GetNullableString(reader, "remarks"),
            reader.GetDateTime(reader.GetOrdinal("created_at")),
            reader.GetDateTime(reader.GetOrdinal("created_at"))), ct)).FirstOrDefault();

        if (review is null)
        {
            throw new InvalidOperationException("Failed to submit member review.");
        }

        await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest(
            "procurement_plan",
            planId,
            "planning_committee_review",
            "Submitted",
            $"Member Review: {request.Decision}",
            null,
            null,
            null,
            null,
            null,
            request.Remarks ?? "Member review submitted.",
            actor), ct);

        return review;
    }
}

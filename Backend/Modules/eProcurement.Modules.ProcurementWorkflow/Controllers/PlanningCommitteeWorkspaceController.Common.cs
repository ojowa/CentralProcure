using System.Data;
using System.Security.Claims;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Modules.ProcurementWorkflow.Services;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class PlanningCommitteeWorkspaceController
{
    private const string ChairRoleKey = "comptroller_procurement";
    private static readonly string[] MemberRoleKeys =
    {
        "planning_statistics_officer",
        "financial_unit_officer",
        "department_head",
        "legal_reviewer",
        "procurement_secretary"
    };
    private const string AdminRoleKey = "admin";

    private static string NormalizeRoleKey(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : value.Trim().ToLowerInvariant().Replace("_", string.Empty).Replace("-", string.Empty).Replace(" ", string.Empty);

    private static string ResolveActorIdentity(ClaimsPrincipal user)
        => user.FindFirstValue(ClaimTypes.Email)
            ?? user.FindFirstValue(ClaimTypes.Name)
            ?? user.Identity?.Name
            ?? string.Empty;

    private static Guid? ResolveAuthenticatedInternalUserId(ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue("internalUserId") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var parsed) ? parsed : null;
    }

    private sealed record LinkContext(
        Guid RequisitionId,
        string Title,
        string Department,
        string? BudgetCode,
        string? ProcurementType,
        decimal TotalEstimate,
        DateTime CreatedAt,
        DateTime? RequiredBy,
        Guid? AppItemId);

    private static PlanningCommitteeQueueAuthority BuildQueueAuthority(string? roleKey)
        => new(true, true, true);

    private static PlanningCommitteeWorkspaceAuthority BuildWorkspaceAuthority(
        string? roleKey,
        bool isAssignedChairman,
        RequisitionSummary requisition,
        ProcurementPlanDetail? plan,
        IReadOnlyList<MemberStatusResponse> statuses,
        CommitteeDecisionResponse? decision)
    {
        var normalized = NormalizeRoleKey(roleKey);
        var isAdmin = normalized == NormalizeRoleKey(AdminRoleKey);
        var isSecretary = normalized == "procurementsecretary";
        var isChair = normalized == NormalizeRoleKey(ChairRoleKey);
        
        var canUnlink = normalized is "financialunitofficer" or "admin";
        var hasFinalDecision = decision is not null;
        var isReviewReopened =
            string.Equals(plan?.CurrentStageKey, "planning_committee_review", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(plan?.Status, "Returned", StringComparison.OrdinalIgnoreCase);
        
        var canSubmitReview = !hasFinalDecision || isReviewReopened;
        
        var hasSubmittedCurrentReview =
            !string.IsNullOrWhiteSpace(normalized) &&
            !isChair &&
            statuses.Any(status =>
                NormalizeRoleKey(status.RoleKey) == normalized &&
                !string.IsNullOrWhiteSpace(status.Decision));

        return new PlanningCommitteeWorkspaceAuthority(
            requisition.AppItemId is null && canSubmitReview,
            canSubmitReview &&
            !string.IsNullOrWhiteSpace(normalized) &&
            !isChair &&
            !isAdmin &&
            MemberRoleKeys.Any(role => NormalizeRoleKey(role) == normalized) &&
            !hasSubmittedCurrentReview,
            canSubmitReview && (isSecretary || isAdmin || isAssignedChairman),
            canUnlink,
            requisition.AppItemId is not null,
            isReviewReopened);
    }

    private async Task<PlanningCommitteeWorkspaceResponse?> BuildWorkspaceAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid requisitionId,
        string? roleKey,
        CancellationToken ct)
    {
        var requisition = await GetRequisitionSummaryAsync(conn, tx, requisitionId, ct);
        if (requisition is null)
        {
            return null;
        }

        var planId = requisition.CommitteePlanId ?? await GetPlanIdFromAppItemAsync(conn, tx, requisitionId, ct);
        var plan = planId.HasValue ? await GetPlanDetailAsync(conn, tx, planId.Value, ct) : null;
        var items = planId.HasValue ? await GetPlanItemsAsync(conn, tx, planId.Value, ct) : new List<ProcurementPlanItemDetail>();
        var reviews = await GetMemberReviewsAsync(conn, tx, requisitionId, ct);
        var statuses = await GetMemberStatusesAsync(conn, tx, requisitionId, ct);
        var decision = await GetDecisionAsync(conn, tx, requisitionId, ct);
        var assignedChairmanId = await PlanningCommitteeChairmanRegistry.GetAssignedChairmanUserIdAsync(conn, tx, ct);
        var currentUserId = ResolveAuthenticatedInternalUserId(User);

        return new PlanningCommitteeWorkspaceResponse(
            requisition,
            plan,
            items,
            reviews,
            statuses,
            decision,
            BuildWorkspaceAuthority(roleKey, currentUserId.HasValue && assignedChairmanId == currentUserId, requisition, plan, statuses, decision));
    }

    private static RequisitionSummary MapSummary(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("requisition_id")),
            reader.GetString(reader.GetOrdinal("title")),
            reader.GetString(reader.GetOrdinal("department")),
            GetNullableGuid(reader, "unit_id"),
            GetNullableGuid(reader, "committee_plan_id"),
            GetNullableString(reader, "committee_plan_title"),
            GetNullableGuid(reader, "app_item_id"),
            GetNullableString(reader, "app_item_description"),
            GetNullableString(reader, "final_committee_decision"),
            reader.GetString(reader.GetOrdinal("status")),
            GetNullableString(reader, "priority"),
            GetNullableString(reader, "funding_source"),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("total_estimate")),
            GetNullableDateTime(reader, "required_by"),
            reader.GetDateTime(reader.GetOrdinal("created_at")));

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

    private static string? GetNullableString(NpgsqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    private static string? GetOptionalNullableString(NpgsqlDataReader reader, string column)
    {
        var ordinal = TryGetOrdinal(reader, column);
        return ordinal.HasValue && !reader.IsDBNull(ordinal.Value) ? reader.GetString(ordinal.Value) : null;
    }

    private static Guid? GetNullableGuid(NpgsqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? null : reader.GetGuid(ordinal);
    }

    private static Guid? GetOptionalNullableGuid(NpgsqlDataReader reader, string column)
    {
        var ordinal = TryGetOrdinal(reader, column);
        return ordinal.HasValue && !reader.IsDBNull(ordinal.Value) ? reader.GetGuid(ordinal.Value) : null;
    }

    private static DateTime? GetNullableDateTime(NpgsqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
    }

    private static DateTime? GetOptionalNullableDateTime(NpgsqlDataReader reader, string column)
    {
        var ordinal = TryGetOrdinal(reader, column);
        return ordinal.HasValue && !reader.IsDBNull(ordinal.Value) ? reader.GetDateTime(ordinal.Value) : null;
    }

    private static int? TryGetOrdinal(NpgsqlDataReader reader, string name)
    {
        try { return reader.GetOrdinal(name); }
        catch (IndexOutOfRangeException) { return null; }
    }
}

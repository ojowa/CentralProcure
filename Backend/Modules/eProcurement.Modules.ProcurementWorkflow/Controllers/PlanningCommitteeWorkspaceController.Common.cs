using System.Data;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;

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

    private static PlanningCommitteeWorkspaceAuthority BuildWorkspaceAuthority(string? roleKey, RequisitionSummary requisition, CommitteeDecisionResponse? decision)
    {
        var normalized = roleKey?.Trim().ToLowerInvariant();
        var canUnlink = normalized is "financial_unit_officer" or "admin";
        var hasFinalDecision = decision is not null;
        return new PlanningCommitteeWorkspaceAuthority(
            requisition.AppItemId is null && !hasFinalDecision,
            !hasFinalDecision && normalized is not null && normalized != ChairRoleKey && MemberRoleKeys.Contains(normalized, StringComparer.OrdinalIgnoreCase),
            !hasFinalDecision && string.Equals(normalized, ChairRoleKey, StringComparison.OrdinalIgnoreCase),
            canUnlink,
            requisition.AppItemId is not null);
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

        return new PlanningCommitteeWorkspaceResponse(
            requisition,
            plan,
            items,
            reviews,
            statuses,
            decision,
            BuildWorkspaceAuthority(roleKey, requisition, decision));
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

    private static Guid? GetNullableGuid(NpgsqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? null : reader.GetGuid(ordinal);
    }

    private static DateTime? GetNullableDateTime(NpgsqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
    }
}

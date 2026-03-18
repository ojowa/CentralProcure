using System.Security.Claims;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Shared.Workflow;

public sealed record WorkflowGrantedAction(
    string ActionKey,
    string StageKey,
    string DisplayName,
    string TaskDescription);

public sealed record WorkflowActionGrantSnapshot(
    string EntityType,
    Guid EntityId,
    string CurrentStageKey,
    string CurrentStageTitle,
    string RoleKey,
    IReadOnlyList<WorkflowGrantedAction> Actions);

public sealed class WorkflowActionGrantService
{
    private static readonly IReadOnlyDictionary<string, string[]> StageActionMap =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["department_need_capture"] = ["procurement_plan.create", "procurement_plan.update"],
            ["planning_committee_review"] = ["planning_committee.review"],
            ["budget_confirmation"] = ["budget.confirm"],
            ["app_approval"] = ["procurement_plan.approve"],
            ["procurement_initiation"] = ["requisition.create", "requisition.update"],
            ["threshold_resolution"] = ["threshold.resolve", "approval.review"],
            ["method_validation"] = ["tender.manage", "tender.publish"],
            ["solicitation"] = ["tender.manage", "tender.publish", "administrative_review.create"],
            ["bid_opening"] = ["bid_opening.manage", "bid_opening.view_detail", "evaluation.actions"],
            ["evaluation"] = ["evaluation.actions", "administrative_review.create"],
            ["tenders_board_review"] = ["approval.review", "approval.decide"],
            ["accounting_officer_review"] = ["cgis.approve", "cgis.reject", "cgis.return", "cgis.escalate", "final_approval.decide", "bpp.create"],
            ["bpp_no_objection"] = ["bpp.create", "bpp.review", "bpp.decide"],
            ["award_and_publication"] = ["contract_award.publish", "administrative_review.create"],
            ["contract_execution"] = ["contract_management.manage"],
            ["inspection_and_payment"] = ["inspection.update", "payment_tracking.view", "closeout.create"],
            ["closeout_and_audit"] = ["closeout.create", "audit_dashboard.view", "audit_trail.view"],
            ["administrative_review"] = ["administrative_review.view", "administrative_review.update", "administrative_review.resolve"]
        };

    private static readonly IReadOnlyDictionary<string, string[]> StageModuleActionMap =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["department_need_capture"] = ["procurement_plan.manage", "requisition.create", "requisition.view", "requisition.track"],
            ["planning_committee_review"] = ["planning_committee.view"],
            ["budget_confirmation"] = ["planning_committee.view"],
            ["app_approval"] = ["procurement_plan.manage", "requisition.view", "requisition.track"],
            ["procurement_initiation"] = ["requisition.create", "requisition.view", "requisition.track"],
            ["threshold_resolution"] = ["approval.review"],
            ["method_validation"] = ["tender.manage"],
            ["solicitation"] = ["tender.manage"],
            ["bid_opening"] = ["bid_opening.manage", "bid_opening.view_detail"],
            ["evaluation"] = ["evaluation.actions", "evaluation_report.view"],
            ["tenders_board_review"] = ["approval.review", "approval.decide"],
            ["accounting_officer_review"] = ["cgis.approve", "cgis.reject", "cgis.return", "cgis.escalate", "high_value_tenders.review", "final_approval.decide", "bpp.create"],
            ["bpp_no_objection"] = ["bpp.create", "bpp.review"],
            ["award_and_publication"] = ["contract_award.publish", "contract_award.view"],
            ["contract_execution"] = ["contract_management.manage"],
            ["inspection_and_payment"] = ["inspection.view", "inspection.update", "payment_tracking.view", "closeout.create"],
            ["closeout_and_audit"] = ["audit_dashboard.view", "audit_trail.view", "compliance_reports.view"],
            ["administrative_review"] = ["administrative_review.view", "administrative_review.update", "administrative_review.resolve"]
        };

    public static string? ResolveRoleKey(ClaimsPrincipal user)
    {
        var rawRole = user.FindFirstValue("role") ?? user.FindFirstValue(ClaimTypes.Role);
        return NormalizeRoleKey(rawRole);
    }

    public async Task<WorkflowActionGrantSnapshot?> GetSnapshotAsync(
        string connectionString,
        ClaimsPrincipal user,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return null;
        }

        var roleKey = ResolveRoleKey(user);
        if (string.IsNullOrWhiteSpace(roleKey))
        {
            return null;
        }

        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var current = await GetRuntimeStageAsync(conn, tx, entityType, entityId, ct);
        if (current is null)
        {
            return null;
        }

        var actions = await GetGrantedActionsForStageAsync(conn, tx, roleKey, current.StageKey, ct);
        await tx.CommitAsync(ct);

        return new WorkflowActionGrantSnapshot(
            current.EntityType,
            current.EntityId,
            current.StageKey,
            current.StageTitle,
            roleKey,
            actions);
    }

    public async Task<bool> HasRequiredActionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        ClaimsPrincipal user,
        string entityType,
        Guid entityId,
        string requiredAction,
        CancellationToken ct)
    {
        var roleKey = ResolveRoleKey(user);
        if (string.IsNullOrWhiteSpace(roleKey))
        {
            return false;
        }

        var current = await GetRuntimeStageAsync(conn, tx, entityType, entityId, ct);
        if (current is null)
        {
            return false;
        }

        var actions = await GetGrantedActionsForStageAsync(conn, tx, roleKey, current.StageKey, ct);
        return actions.Any(action => string.Equals(action.ActionKey, requiredAction, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<IReadOnlyList<string>> GetRoleModuleActionsAsync(
        string connectionString,
        string? role,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Array.Empty<string>();
        }

        var roleKey = NormalizeRoleKey(role);
        if (string.IsNullOrWhiteSpace(roleKey))
        {
            return Array.Empty<string>();
        }

        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(@"
SELECT DISTINCT stage_key
FROM procurement_workflow.workflow_role_tasks
WHERE role_key = @p_role_key;", conn);
        cmd.Parameters.AddWithValue("p_role_key", NpgsqlDbType.Varchar, roleKey);

        var results = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var stageKey = reader.GetString(reader.GetOrdinal("stage_key"));
            if (!StageModuleActionMap.TryGetValue(stageKey, out var actions))
            {
                continue;
            }

            foreach (var action in actions)
            {
                results.Add(action);
            }
        }

        return results.OrderBy(action => action, StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private static string? NormalizeRoleKey(string? role)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            return null;
        }

        var trimmed = role.Trim();
        var withUnderscores = trimmed.Replace("-", "_").Replace(" ", "_");
        var snakeCase = System.Text.RegularExpressions.Regex.Replace(withUnderscores, "([a-z0-9])([A-Z])", "$1_$2");
        return snakeCase.ToLowerInvariant() switch
        {
            "system_administrator" => "ict_admin",
            "tenders_board_member" => "tenders_board",
            "audit_officer" => "audit_oversight",
            "department_user" => "requisitioning_officer",
            "procurement_planning_committee" => "planning_statistics_officer",
            "bpp_liaison" => "bpp_liaison",
            "bpp_reviewer" => "bpp_reviewer",
            var value => value
        };
    }

    private async Task<IReadOnlyList<WorkflowGrantedAction>> GetGrantedActionsForStageAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string roleKey,
        string stageKey,
        CancellationToken ct)
    {
        const string sql = @"
SELECT display_name, task_description
FROM procurement_workflow.workflow_role_tasks
WHERE role_key = @p_role_key
  AND stage_key = @p_stage_key
ORDER BY created_at ASC;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_role_key", NpgsqlDbType.Varchar, roleKey);
        cmd.Parameters.AddWithValue("p_stage_key", NpgsqlDbType.Varchar, stageKey);

        var results = new List<WorkflowGrantedAction>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var displayName = reader.GetString(reader.GetOrdinal("display_name"));
            var taskDescription = reader.GetString(reader.GetOrdinal("task_description"));
            if (!StageActionMap.TryGetValue(stageKey, out var actionKeys))
            {
                continue;
            }

            foreach (var actionKey in actionKeys)
            {
                results.Add(new WorkflowGrantedAction(actionKey, stageKey, displayName, taskDescription));
            }
        }

        return results
            .DistinctBy(action => action.ActionKey, StringComparer.OrdinalIgnoreCase)
            .OrderBy(action => action.ActionKey, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static async Task<RuntimeStageState?> GetRuntimeStageAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT
    wi.entity_type,
    wi.entity_id,
    wi.current_stage_key,
    sc.stage_title
FROM procurement_workflow.workflow_instances wi
JOIN procurement_workflow.workflow_stage_catalog sc
  ON sc.stage_key = wi.current_stage_key
WHERE wi.entity_type = @p_entity_type
  AND wi.entity_id = @p_entity_id;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, entityType.Trim().ToLowerInvariant());
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new RuntimeStageState(
            reader.GetString(reader.GetOrdinal("entity_type")),
            reader.GetGuid(reader.GetOrdinal("entity_id")),
            reader.GetString(reader.GetOrdinal("current_stage_key")),
            reader.GetString(reader.GetOrdinal("stage_title")));
    }

    private sealed record RuntimeStageState(
        string EntityType,
        Guid EntityId,
        string StageKey,
        string StageTitle);
}

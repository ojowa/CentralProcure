using eProcurement.Modules.Identity.DTOs;
using Npgsql;

namespace eProcurement.Modules.Identity.Services;

internal static class InternalModuleCatalog
{
    private static readonly IReadOnlyDictionary<string, string> RoleAliases =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["system_administrator"] = "ict_admin",
            ["tenders_board_member"] = "tenders_board",
            ["audit_officer"] = "audit_oversight",
            ["department_user"] = "requisitioning_officer",
            ["procurement_planning_committee"] = "planning_statistics_officer",
            ["bppliaison"] = "bpp_liaison",
            ["bppreviewer"] = "bpp_reviewer",
            ["requisitioningofficer"] = "requisitioning_officer",
            ["departmenthead"] = "department_head",
            ["procurementmanager"] = "procurement_manager",
            ["planningstatisticsofficer"] = "planning_statistics_officer",
            ["financialunitofficer"] = "financial_unit_officer",
            ["procurementsecretary"] = "procurement_secretary",
            ["comptrollerprocurement"] = "comptroller_procurement",
            ["legalreviewer"] = "legal_reviewer",
            ["legalreviewofficer"] = "legal_reviewer",
            ["technicalevaluator"] = "technical_evaluator",
            ["financialevaluator"] = "financial_evaluator",
            ["evaluationcommittee"] = "evaluation_committee",
            ["tendersboardmember"] = "tenders_board",
            ["tendersboardsecretary"] = "tenders_board_secretary",
            ["accountingofficer"] = "accounting_officer",
            ["cgis"] = "accounting_officer",
            ["complaintsreviewofficer"] = "complaints_review_officer",
            ["contractmanager"] = "contract_manager",
            ["inspectionofficer"] = "inspection_officer",
            ["paymentofficer"] = "payment_officer"
        };

    private static readonly IReadOnlySet<string> WorkflowScopedActions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "procurement_plan.manage",
        "requisition.create",
        "requisition.view",
        "requisition.track",
        "planning_committee.view",
        "approval.review",
        "tender.manage",
        "bid_opening.manage",
        "bid_opening.view_detail",
        "evaluation.actions",
        "evaluation_report.view",
        "approval.decide",
        "high_value_tenders.review",
        "bpp.create",
        "bpp.review",
        "contract_award.publish",
        "contract_award.view",
        "contract_management.manage",
        "inspection.view",
        "inspection.update",
        "payment_tracking.view",
        "closeout.create",
        "audit_dashboard.view",
        "audit_trail.view",
        "compliance_reports.view",
        "administrative_review.view",
        "administrative_review.update",
        "administrative_review.resolve"
    };

    public static async Task<IReadOnlyList<InternalModuleResult>> GetModulesForRoleAsync(string connectionString, string? role, IReadOnlyList<string>? additionalActions = null, CancellationToken ct = default)
    {
        var normalizedRole = NormalizeRoleKey(role);
        if (string.IsNullOrWhiteSpace(normalizedRole))
        {
            return [];
        }

        var additionalActionSet = additionalActions is null
            ? null
            : new HashSet<string>(additionalActions, StringComparer.OrdinalIgnoreCase);

        var modules = await LoadModulesFromDbAsync(connectionString, normalizedRole, ct);

        return modules
            .GroupBy(module => module.Id, StringComparer.OrdinalIgnoreCase)
            .Select(group =>
            {
                var first = group.First();
                var catalogActions = first.CatalogActions;

                var actions = first.Actions
                    .Where(action =>
                        additionalActionSet is null ||
                        additionalActionSet.Count == 0 ||
                        !WorkflowScopedActions.Contains(action) ||
                        additionalActionSet.Contains(action) ||
                        action.StartsWith("admin.", StringComparison.OrdinalIgnoreCase))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(action => action, StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                return new InternalModuleResult(
                    first.Id,
                    first.Title,
                    first.Section,
                    first.Description,
                    first.Microservice,
                    first.ControlPurpose,
                    actions,
                    catalogActions);
            })
            .ToArray();
    }

    public static async Task<IReadOnlyList<InternalModuleResult>> GetAllModulesAsync(string connectionString, IReadOnlyList<string>? additionalActions = null, CancellationToken ct = default)
    {
        var additionalActionSet = additionalActions is null
            ? null
            : new HashSet<string>(additionalActions, StringComparer.OrdinalIgnoreCase);

        var modules = await LoadModulesFromDbAsync(connectionString, null, ct);

        return modules
            .GroupBy(module => module.Id, StringComparer.OrdinalIgnoreCase)
            .Select(group =>
            {
                var first = group.First();
                var catalogActions = first.CatalogActions;

                var actions = first.Actions
                    .Where(action =>
                        additionalActionSet is null ||
                        additionalActionSet.Count == 0 ||
                        !WorkflowScopedActions.Contains(action) ||
                        additionalActionSet.Contains(action) ||
                        action.StartsWith("admin.", StringComparison.OrdinalIgnoreCase))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(action => action, StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                return new InternalModuleResult(
                    first.Id,
                    first.Title,
                    first.Section,
                    first.Description,
                    first.Microservice,
                    first.ControlPurpose,
                    actions,
                    catalogActions);
            })
            .ToArray();
    }

    private static async Task<List<InternalModuleResult>> LoadModulesFromDbAsync(string connectionString, string? normalizedRole, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);

        var sql = @"
            SELECT m.module_id, m.title, m.section, m.description, m.microservice, m.control_purpose, m.actions
            FROM identity.internal_modules m
            WHERE m.is_active = TRUE";

        if (normalizedRole != null)
        {
            sql += @" AND EXISTS (
                SELECT 1 FROM identity.internal_module_allowed_roles ar
                WHERE ar.module_id = m.module_id AND lower(ar.role_name) = lower(@p_role)
            )";
        }

        await using var cmd = new NpgsqlCommand(sql, conn);
        if (normalizedRole != null)
        {
            cmd.Parameters.AddWithValue("p_role", normalizedRole);
        }

        var results = new List<InternalModuleResult>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var actions = (string[])reader.GetValue(6);
            results.Add(new InternalModuleResult(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetString(5),
                actions,
                actions
            ));
        }
        return results;
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
        var normalized = snakeCase.ToLowerInvariant();

        return RoleAliases.TryGetValue(normalized, out var alias)
            ? alias
            : normalized;
    }
}

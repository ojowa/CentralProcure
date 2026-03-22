using eProcurement.Modules.Identity.DTOs;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Identity.Controllers;

public partial class AuthController
{
    private static IReadOnlyList<InternalModuleResult> ApplyModuleGrants(
        IReadOnlyList<InternalModuleResult> baseModules,
        IReadOnlyList<InternalModuleResult> catalogModules,
        IReadOnlyDictionary<string, bool> roleGrants,
        IReadOnlyDictionary<string, bool> userGrants)
    {
        var visibleModuleIds = new HashSet<string>(
            baseModules.Select(module => module.Id),
            StringComparer.OrdinalIgnoreCase);

        foreach (var (moduleId, isEnabled) in roleGrants)
        {
            if (isEnabled)
            {
                visibleModuleIds.Add(moduleId);
            }
            else
            {
                visibleModuleIds.Remove(moduleId);
            }
        }

        foreach (var (moduleId, isEnabled) in userGrants)
        {
            if (isEnabled)
            {
                visibleModuleIds.Add(moduleId);
            }
            else
            {
                visibleModuleIds.Remove(moduleId);
            }
        }

        return catalogModules
            .Where(module => visibleModuleIds.Contains(module.Id))
            .Select(module =>
            {
                roleGrants.TryGetValue(module.Id, out var roleGrantEnabled);
                var hasRoleOverride = roleGrants.ContainsKey(module.Id);
                userGrants.TryGetValue(module.Id, out var userGrantEnabled);
                var hasUserOverride = userGrants.ContainsKey(module.Id);

                var grantSource = hasUserOverride
                    ? "user_override"
                    : hasRoleOverride
                        ? "role_override"
                        : "catalog_role";

                return module with
                {
                    GrantSource = grantSource,
                    IsVisible = true,
                    HasRoleOverride = hasRoleOverride,
                    HasUserOverride = hasUserOverride
                };
            })
            .ToArray();
    }

    private static async Task<IReadOnlyDictionary<string, bool>> LoadRoleModuleGrantsAsync(
        string connectionString,
        string role,
        CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(@"
SELECT g.module_id, g.is_enabled
FROM identity.internal_module_grants g
JOIN identity.roles r ON r.role_id = g.role_id
WHERE lower(r.role_name) = lower(@p_role_name);", conn);
        cmd.Parameters.AddWithValue("p_role_name", NpgsqlDbType.Varchar, role);

        var results = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var moduleId = reader.GetString(reader.GetOrdinal("module_id"));
            var isEnabled = reader.GetBoolean(reader.GetOrdinal("is_enabled"));
            results[moduleId] = isEnabled;
        }

        return results;
    }

    private static async Task<IReadOnlyDictionary<string, bool>> LoadUserModuleGrantsAsync(
        string connectionString,
        Guid internalUserId,
        CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(@"
SELECT module_id, is_enabled
FROM identity.internal_module_grants
WHERE internal_user_id = @p_internal_user_id;", conn);
        cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);

        var results = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var moduleId = reader.GetString(reader.GetOrdinal("module_id"));
            var isEnabled = reader.GetBoolean(reader.GetOrdinal("is_enabled"));
            results[moduleId] = isEnabled;
        }

        return results;
    }
}

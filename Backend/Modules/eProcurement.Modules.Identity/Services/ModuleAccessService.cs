using System.Data;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.Identity.DTOs;

namespace eProcurement.Modules.Identity.Services;

public class ModuleAccessService : IModuleAccessService
{
    private readonly IConfiguration _config;
    private readonly ILogger<ModuleAccessService> _logger;

    public ModuleAccessService(IConfiguration config, ILogger<ModuleAccessService> logger)
    {
        _config = config;
        _logger = logger;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    public Task<IReadOnlyList<InternalModuleResult>> GetModuleCatalogAsync(string connectionString, CancellationToken ct) => 
        InternalModuleCatalog.GetAllModulesAsync(connectionString, null, ct);

    public async Task<List<RoleModuleAccessGrantResult>> GetRoleModuleAccessAsync(CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT * FROM identity.get_role_module_grants();", conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<RoleModuleAccessGrantResult>();
        while (await reader.ReadAsync(ct)) results.Add(MapRoleModuleAccessGrantResult(reader));
        return results;
    }

    public async Task<List<UserModuleAccessGrantResult>> GetUserModuleAccessAsync(CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT * FROM identity.get_user_module_grants();", conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<UserModuleAccessGrantResult>();
        while (await reader.ReadAsync(ct)) results.Add(MapUserModuleAccessGrantResult(reader));
        return results;
    }

    public async Task<List<ModuleAccessAuditResult>> GetModuleAccessAuditAsync(string? roleName, Guid? internalUserId, int limit, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        const string sql = @"
            SELECT a.audit_id, a.target_type, r.role_name, iu.internal_user_id, iu.email, iu.username, a.module_id, a.previous_state, a.new_state, a.changed_by, a.change_source, a.changed_at
            FROM identity.internal_module_grant_audit a
            LEFT JOIN identity.roles r ON r.role_id = a.role_id
            LEFT JOIN identity.internal_users iu ON iu.internal_user_id = a.internal_user_id
            WHERE (@p_role_name IS NULL OR lower(r.role_name) = lower(@p_role_name))
              AND (@p_internal_user_id IS NULL OR a.internal_user_id = @p_internal_user_id)
            ORDER BY a.changed_at DESC LIMIT @p_limit;";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_role_name", NpgsqlDbType.Varchar, (object?)roleName ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, (object?)internalUserId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, limit);
        try
        {
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            var results = new List<ModuleAccessAuditResult>();
            while (await reader.ReadAsync(ct)) results.Add(MapModuleAccessAuditResult(reader));
            return results;
        }
        catch (PostgresException ex) when (ex.SqlState == "42P01") { return new List<ModuleAccessAuditResult>(); }
    }

    public async Task<List<UserRoleAuditResult>> GetUserRoleAuditAsync(Guid? internalUserId, int limit, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        const string sql = @"
            SELECT 
                a.audit_id, a.target_internal_user_id, 
                iu_target.email AS target_email, iu_target.username AS target_username,
                r_old.role_name AS previous_role_name, 
                r_new.role_name AS new_role_name,
                iu_admin.email AS changed_by_email, iu_admin.username AS changed_by_username,
                a.changed_at, a.change_reason
            FROM identity.user_role_audit a
            JOIN identity.internal_users iu_target ON iu_target.internal_user_id = a.target_internal_user_id
            LEFT JOIN identity.roles r_old ON r_old.role_id = a.previous_role_id
            JOIN identity.roles r_new ON r_new.role_id = a.new_role_id
            LEFT JOIN identity.internal_users iu_admin ON iu_admin.internal_user_id = a.changed_by_user_id
            WHERE (@p_internal_user_id IS NULL OR a.target_internal_user_id = @p_internal_user_id)
            ORDER BY a.changed_at DESC LIMIT @p_limit;";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, (object?)internalUserId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, limit);
        try
        {
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            var results = new List<UserRoleAuditResult>();
            while (await reader.ReadAsync(ct)) results.Add(MapUserRoleAuditResult(reader));
            return results;
        }
        catch (PostgresException ex) when (ex.SqlState == "42P01") { return new List<UserRoleAuditResult>(); }
    }

    public async Task<RoleModuleAccessGrantResult?> UpdateRoleModuleAccessAsync(UpdateRoleModuleAccessRequest request, Guid adminUserId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var roleId = await ResolveRoleIdAsync(conn, tx, request.RoleName!, ct);
        if (roleId is null) throw new ArgumentException("Role not found.");
        var previousState = await GetRoleGrantStateAsync(conn, tx, roleId.Value, request.ModuleId!, ct);
        await using var cmd = new NpgsqlCommand("SELECT * FROM identity.upsert_role_module_grant(@p_role_name, @p_module_id, @p_is_enabled, @p_updated_by);", conn, tx);
        cmd.Parameters.AddWithValue("p_role_name", request.RoleName);
        cmd.Parameters.AddWithValue("p_module_id", request.ModuleId);
        cmd.Parameters.AddWithValue("p_is_enabled", request.IsEnabled);
        cmd.Parameters.AddWithValue("p_updated_by", adminUserId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct))
        {
            var result = MapRoleModuleAccessGrantResult(reader);
            await reader.CloseAsync();
            await WriteModuleAccessAuditAsync(conn, tx, "role", roleId, null, request.ModuleId!, previousState, request.IsEnabled, adminUserId, "single", ct);
            await tx.CommitAsync(ct);
            return result;
        }
        await tx.CommitAsync(ct); return null;
    }

    public async Task<UserModuleAccessGrantResult?> UpdateUserModuleAccessAsync(UpdateUserModuleAccessRequest request, Guid adminUserId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var previousState = await GetUserGrantStateAsync(conn, tx, request.InternalUserId, request.ModuleId!, ct);
        await using var cmd = new NpgsqlCommand("SELECT * FROM identity.upsert_user_module_grant(@p_internal_user_id, @p_module_id, @p_is_enabled, @p_updated_by);", conn, tx);
        cmd.Parameters.AddWithValue("p_internal_user_id", request.InternalUserId);
        cmd.Parameters.AddWithValue("p_module_id", request.ModuleId);
        cmd.Parameters.AddWithValue("p_is_enabled", request.IsEnabled);
        cmd.Parameters.AddWithValue("p_updated_by", adminUserId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct))
        {
            var result = MapUserModuleAccessGrantResult(reader);
            await reader.CloseAsync();
            await WriteModuleAccessAuditAsync(conn, tx, "user", null, request.InternalUserId, request.ModuleId!, previousState, request.IsEnabled, adminUserId, "single", ct);
            await tx.CommitAsync(ct);
            return result;
        }
        await tx.CommitAsync(ct); return null;
    }

    public async Task DeleteRoleModuleAccessAsync(string roleName, string moduleId, Guid adminUserId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var roleId = await ResolveRoleIdAsync(conn, tx, roleName, ct);
        if (roleId is null) throw new ArgumentException("Role not found.");
        var previousState = await GetRoleGrantStateAsync(conn, tx, roleId.Value, moduleId, ct);
        if (previousState is null) { await tx.CommitAsync(ct); return; }
        await using var cmd = new NpgsqlCommand("DELETE FROM identity.internal_module_grants WHERE role_id = @p_role_id AND module_id = @p_module_id;", conn, tx);
        cmd.Parameters.AddWithValue("p_role_id", roleId.Value); cmd.Parameters.AddWithValue("p_module_id", moduleId);
        await cmd.ExecuteNonQueryAsync(ct);
        await WriteModuleAccessAuditAsync(conn, tx, "role", roleId, null, moduleId, previousState, null, adminUserId, "single_reset", ct);
        await tx.CommitAsync(ct);
    }

    public async Task DeleteUserModuleAccessAsync(Guid internalUserId, string moduleId, Guid adminUserId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var previousState = await GetUserGrantStateAsync(conn, tx, internalUserId, moduleId, ct);
        if (previousState is null) { await tx.CommitAsync(ct); return; }
        await using var cmd = new NpgsqlCommand("DELETE FROM identity.internal_module_grants WHERE internal_user_id = @p_internal_user_id AND module_id = @p_module_id;", conn, tx);
        cmd.Parameters.AddWithValue("p_internal_user_id", internalUserId); cmd.Parameters.AddWithValue("p_module_id", moduleId);
        await cmd.ExecuteNonQueryAsync(ct);
        await WriteModuleAccessAuditAsync(conn, tx, "user", null, internalUserId, moduleId, previousState, null, adminUserId, "single_reset", ct);
        await tx.CommitAsync(ct);
    }

    public async Task<List<InternalOrganizationalUnitResult>> GetInternalUnitsAsync(CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        const string sql = @"SELECT ou.unit_id, ou.unit_name, ou.unit_code, ou.unit_type, ou.parent_unit_id, parent.unit_name AS parent_unit_name, ou.sort_order, ou.is_assignable, ou.is_active FROM identity.organizational_units ou LEFT JOIN identity.organizational_units parent ON parent.unit_id = ou.parent_unit_id ORDER BY ou.sort_order ASC, ou.unit_name ASC";
        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<InternalOrganizationalUnitResult>();
        while (await reader.ReadAsync(ct)) results.Add(MapInternalOrganizationalUnitResult(reader));
        return results;
    }

    public async Task<InternalOrganizationalUnitResult?> ManageInternalUnitAsync(ManageInternalOrganizationalUnitRequest request, Guid adminUserId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("identity.manage_organizational_unit_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_unit_id", NpgsqlDbType.Uuid, (object?)request.UnitId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_unit_code", NpgsqlDbType.Varchar, request.UnitCode);
        cmd.Parameters.AddWithValue("p_unit_name", NpgsqlDbType.Varchar, request.UnitName);
        cmd.Parameters.AddWithValue("p_unit_type", NpgsqlDbType.Varchar, request.UnitType);
        cmd.Parameters.AddWithValue("p_parent_unit_id", NpgsqlDbType.Uuid, (object?)request.ParentUnitId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_sort_order", NpgsqlDbType.Integer, request.SortOrder);
        cmd.Parameters.AddWithValue("p_is_assignable", NpgsqlDbType.Boolean, request.IsAssignable);
        cmd.Parameters.AddWithValue("p_is_active", NpgsqlDbType.Boolean, request.IsActive);
        cmd.Parameters.AddWithValue("p_updated_by", NpgsqlDbType.Varchar, adminUserId.ToString());
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

        var results = await ExecuteRefcursorAsync(cmd, MapInternalOrganizationalUnitResult, ct);
        await tx.CommitAsync(ct);
        return results.FirstOrDefault();
    }

    public async Task<List<InternalUnitStaffResult>> GetUnitStaffAsync(Guid unitId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        const string sql = @"
            SELECT iu.internal_user_id, iu.email, iu.username, iu.first_name, iu.surname, r.role_name, iu.status
            FROM identity.internal_users iu
            JOIN identity.roles r ON r.role_id = iu.role_id
            WHERE iu.unit_id = @p_unit_id
            ORDER BY iu.surname ASC, iu.first_name ASC";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_unit_id", NpgsqlDbType.Uuid, unitId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<InternalUnitStaffResult>();
        while (await reader.ReadAsync(ct)) results.Add(new InternalUnitStaffResult(
            reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4), reader.GetString(5), reader.GetString(6)
        ));
        return results;
    }

    private async Task<List<T>> ExecuteRefcursorAsync<T>(NpgsqlCommand cmd, Func<NpgsqlDataReader, T> mapper, CancellationToken ct)
    {
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return new List<T>();
        var cursorName = reader.GetString(0);
        await reader.CloseAsync();
        await using var fetchCmd = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\";", cmd.Connection, cmd.Transaction);
        await using var fetchReader = await fetchCmd.ExecuteReaderAsync(ct);
        var list = new List<T>();
        while (await fetchReader.ReadAsync(ct)) list.Add(mapper(fetchReader));
        return list;
    }

    public async Task DeleteRoleModuleAccessBulkAsync(string roleName, Guid adminUserId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var roleId = await ResolveRoleIdAsync(conn, tx, roleName, ct);
        if (roleId is null) throw new ArgumentException("Role not found.");
        var existing = await LoadRoleGrantsAsync(conn, tx, roleId.Value, ct);
        await using var cmd = new NpgsqlCommand("DELETE FROM identity.internal_module_grants WHERE role_id = @p_role_id;", conn, tx);
        cmd.Parameters.AddWithValue("p_role_id", roleId.Value);
        await cmd.ExecuteNonQueryAsync(ct);
        foreach (var (moduleId, previousState) in existing)
            await WriteModuleAccessAuditAsync(conn, tx, "role", roleId, null, moduleId, previousState, null, adminUserId, "reset_all", ct);
        await tx.CommitAsync(ct);
    }

    public async Task BulkUpdateUserModuleAccessAsync(BulkUserModuleAccessRequest request, Guid adminUserId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var existing = await LoadUserGrantsAsync(conn, tx, request.InternalUserId, ct);
        foreach (var grant in request.Grants)
        {
            await using var cmd = new NpgsqlCommand("SELECT * FROM identity.upsert_user_module_grant(@p_internal_user_id, @p_module_id, @p_is_enabled, @p_updated_by);", conn, tx);
            cmd.Parameters.AddWithValue("p_internal_user_id", request.InternalUserId);
            cmd.Parameters.AddWithValue("p_module_id", grant.ModuleId);
            cmd.Parameters.AddWithValue("p_is_enabled", grant.IsEnabled);
            cmd.Parameters.AddWithValue("p_updated_by", adminUserId);
            await cmd.ExecuteNonQueryAsync(ct);
            existing.TryGetValue(grant.ModuleId, out var previousState);
            await WriteModuleAccessAuditAsync(conn, tx, "user", null, request.InternalUserId, grant.ModuleId, previousState, grant.IsEnabled, adminUserId, "bulk", ct);
        }
        await tx.CommitAsync(ct);
    }

    public async Task DeleteUserModuleAccessBulkAsync(Guid internalUserId, Guid adminUserId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var existing = await LoadUserGrantsAsync(conn, tx, internalUserId, ct);
        await using var cmd = new NpgsqlCommand("DELETE FROM identity.internal_module_grants WHERE internal_user_id = @p_internal_user_id;", conn, tx);
        cmd.Parameters.AddWithValue("p_internal_user_id", internalUserId);
        await cmd.ExecuteNonQueryAsync(ct);
        foreach (var (moduleId, previousState) in existing)
            await WriteModuleAccessAuditAsync(conn, tx, "user", null, internalUserId, moduleId, previousState, null, adminUserId, "reset_all", ct);
        await tx.CommitAsync(ct);
    }

    private static async Task<Dictionary<string, bool>> LoadUserGrantsAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid uid, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("SELECT module_id, is_enabled FROM identity.internal_module_grants WHERE internal_user_id = @p_uid;", conn, tx);
        cmd.Parameters.AddWithValue("p_uid", uid);
        var res = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) res[r.GetString(0)] = r.GetBoolean(1);
        return res;
    }

    private static async Task<Dictionary<string, bool>> LoadRoleGrantsAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid rid, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("SELECT module_id, is_enabled FROM identity.internal_module_grants WHERE role_id = @p_rid;", conn, tx);
        cmd.Parameters.AddWithValue("p_rid", rid);
        var res = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) res[r.GetString(0)] = r.GetBoolean(1);
        return res;
    }

    private static InternalOrganizationalUnitResult MapInternalOrganizationalUnitResult(NpgsqlDataReader r) => new(
        r.GetGuid(0), 
        r.GetString(1), 
        r.GetString(2), 
        r.GetString(3), 
        r.IsDBNull(4) ? null : r.GetGuid(4), 
        r.IsDBNull(5) ? null : r.GetString(5), 
        r.GetInt32(6), 
        r.GetBoolean(7),
        r.GetBoolean(8));


    private static async Task<Guid?> ResolveRoleIdAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string roleName, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("SELECT role_id FROM identity.roles WHERE lower(role_name) = lower(@p_role_name) LIMIT 1;", conn, tx);
        cmd.Parameters.AddWithValue("p_role_name", roleName); var res = await cmd.ExecuteScalarAsync(ct); return res is Guid id ? id : null;
    }

    private static async Task<bool?> GetRoleGrantStateAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid id, string mod, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("SELECT is_enabled FROM identity.internal_module_grants WHERE role_id = @p_id AND module_id = @p_mod;", conn, tx);
        cmd.Parameters.AddWithValue("p_id", id); cmd.Parameters.AddWithValue("p_mod", mod); var res = await cmd.ExecuteScalarAsync(ct); return res is bool b ? b : null;
    }

    private static async Task<bool?> GetUserGrantStateAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid id, string mod, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("SELECT is_enabled FROM identity.internal_module_grants WHERE internal_user_id = @p_id AND module_id = @p_mod;", conn, tx);
        cmd.Parameters.AddWithValue("p_id", id); cmd.Parameters.AddWithValue("p_mod", mod); var res = await cmd.ExecuteScalarAsync(ct); return res is bool b ? b : null;
    }

    private static async Task WriteModuleAccessAuditAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string type, Guid? rid, Guid? uid, string mod, bool? prev, bool? curr, Guid by, string src, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("INSERT INTO identity.internal_module_grant_audit (target_type, role_id, internal_user_id, module_id, previous_state, new_state, changed_by, change_source) VALUES (@p_type, @p_rid, @p_uid, @p_mod, @p_prev, @p_curr, @p_by, @p_src);", conn, tx);
        cmd.Parameters.AddWithValue("p_type", type); cmd.Parameters.AddWithValue("p_rid", (object?)rid ?? DBNull.Value); cmd.Parameters.AddWithValue("p_uid", (object?)uid ?? DBNull.Value); cmd.Parameters.AddWithValue("p_mod", mod); cmd.Parameters.AddWithValue("p_prev", (object?)prev ?? DBNull.Value); cmd.Parameters.AddWithValue("p_curr", (object?)curr ?? DBNull.Value); cmd.Parameters.AddWithValue("p_by", by); cmd.Parameters.AddWithValue("p_src", src);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static RoleModuleAccessGrantResult MapRoleModuleAccessGrantResult(NpgsqlDataReader r) => new(r.GetString(0), r.GetString(1), r.GetBoolean(2), r.GetDateTime(3));
    private static UserModuleAccessGrantResult MapUserModuleAccessGrantResult(NpgsqlDataReader r) => new(r.GetGuid(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4), r.GetBoolean(5), r.GetDateTime(6));
    private static ModuleAccessAuditResult MapModuleAccessAuditResult(NpgsqlDataReader r) => new(r.GetGuid(0), r.GetString(1), r.IsDBNull(2) ? null : r.GetString(2), r.IsDBNull(3) ? null : r.GetGuid(3), r.IsDBNull(4) ? null : r.GetString(4), r.IsDBNull(5) ? null : r.GetString(5), r.GetString(6), r.IsDBNull(7) ? null : r.GetBoolean(7), r.IsDBNull(8) ? null : r.GetBoolean(8), r.IsDBNull(9) ? null : r.GetGuid(9), r.GetString(10), r.GetDateTime(11));

    private static UserRoleAuditResult MapUserRoleAuditResult(NpgsqlDataReader r) => new(
        r.GetGuid(0),
        r.GetGuid(1),
        r.GetString(2),
        r.GetString(3),
        r.IsDBNull(4) ? null : r.GetString(4),
        r.GetString(5),
        r.IsDBNull(6) ? null : r.GetString(6),
        r.IsDBNull(7) ? null : r.GetString(7),
        r.GetDateTime(8),
        r.IsDBNull(9) ? null : r.GetString(9));
}

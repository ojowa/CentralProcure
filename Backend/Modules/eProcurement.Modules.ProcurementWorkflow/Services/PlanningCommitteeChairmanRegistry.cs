using System.Data;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;

namespace eProcurement.Modules.ProcurementWorkflow.Services;

internal static class PlanningCommitteeChairmanRegistry
{
    private const string CommitteeCode = "planning_committee";
    private const string PlanningCommitteeModuleId = "procurement-planning-committee";

    public static async Task EnsureTableAsync(NpgsqlConnection conn, NpgsqlTransaction? tx, CancellationToken ct)
    {
        const string sql = """
CREATE TABLE IF NOT EXISTS procurement_workflow.planning_committee_configuration (
    committee_code character varying PRIMARY KEY,
    chairman_internal_user_id uuid NULL REFERENCES identity.internal_users(internal_user_id) ON DELETE SET NULL,
    assigned_by character varying NULL,
    assigned_at timestamp without time zone NULL,
    updated_at timestamp without time zone NOT NULL DEFAULT NOW()
);
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public static async Task<PlanningCommitteeChairmanAssignmentResponse> GetAssignmentAsync(NpgsqlConnection conn, NpgsqlTransaction? tx, CancellationToken ct)
    {
        await EnsureTableAsync(conn, tx, ct);

        const string sql = """
SELECT
    cfg.chairman_internal_user_id,
    iu.email,
    iu.username,
    r.role_name,
    iu.status,
    iu.unit_id,
    u.unit_name,
    cfg.assigned_by,
    cfg.assigned_at
FROM procurement_workflow.planning_committee_configuration cfg
LEFT JOIN identity.internal_users iu
  ON iu.internal_user_id = cfg.chairman_internal_user_id
LEFT JOIN identity.roles r
  ON r.role_id = iu.role_id
LEFT JOIN identity.organizational_units u
  ON u.unit_id = iu.unit_id
WHERE cfg.committee_code = @p_committee_code
LIMIT 1;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_committee_code", NpgsqlDbType.Varchar, CommitteeCode);
        await using var reader = await cmd.ExecuteReaderAsync(ct);

        if (!await reader.ReadAsync(ct))
        {
            return new PlanningCommitteeChairmanAssignmentResponse(null, null, null, null, null, null, null, null, null);
        }

        return new PlanningCommitteeChairmanAssignmentResponse(
            GetNullableGuid(reader, "chairman_internal_user_id"),
            GetNullableString(reader, "email"),
            GetNullableString(reader, "username"),
            GetNullableString(reader, "role_name"),
            GetNullableString(reader, "status"),
            GetNullableGuid(reader, "unit_id"),
            GetNullableString(reader, "unit_name"),
            GetNullableString(reader, "assigned_by"),
            GetNullableDateTime(reader, "assigned_at"));
    }

    public static async Task<PlanningCommitteeChairmanAssignmentResponse> UpsertAssignmentAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid? internalUserId,
        string assignedBy,
        Guid? assignedByUserId,
        CancellationToken ct)
    {
        await EnsureTableAsync(conn, tx, ct);

        if (internalUserId.HasValue)
        {
            await EnsureAssignableUserAsync(conn, tx, internalUserId.Value, ct);
        }

        const string sql = """
INSERT INTO procurement_workflow.planning_committee_configuration (
    committee_code,
    chairman_internal_user_id,
    assigned_by,
    assigned_at,
    updated_at
)
VALUES (
    @p_committee_code,
    @p_internal_user_id,
    NULLIF(@p_assigned_by, ''),
    CASE WHEN @p_internal_user_id IS NULL THEN NULL ELSE NOW() END,
    NOW()
)
ON CONFLICT (committee_code) DO UPDATE
SET chairman_internal_user_id = EXCLUDED.chairman_internal_user_id,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = EXCLUDED.assigned_at,
    updated_at = NOW();
""";
        await using (var cmd = new NpgsqlCommand(sql, conn, tx))
        {
            cmd.Parameters.AddWithValue("p_committee_code", NpgsqlDbType.Varchar, CommitteeCode);
            cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, (object?)internalUserId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_assigned_by", NpgsqlDbType.Varchar, assignedBy ?? string.Empty);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        if (internalUserId.HasValue)
        {
            await EnsurePlanningCommitteeModuleGrantAsync(conn, tx, internalUserId.Value, assignedByUserId, ct);
        }

        return await GetAssignmentAsync(conn, tx, ct);
    }

    public static async Task<Guid?> GetAssignedChairmanUserIdAsync(NpgsqlConnection conn, NpgsqlTransaction? tx, CancellationToken ct)
    {
        await EnsureTableAsync(conn, tx, ct);

        const string sql = """
SELECT chairman_internal_user_id
FROM procurement_workflow.planning_committee_configuration
WHERE committee_code = @p_committee_code
LIMIT 1;
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_committee_code", NpgsqlDbType.Varchar, CommitteeCode);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is Guid value ? value : null;
    }

    private static async Task EnsureAssignableUserAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid internalUserId, CancellationToken ct)
    {
        const string sql = """
SELECT EXISTS (
    SELECT 1
    FROM identity.internal_users
    WHERE internal_user_id = @p_internal_user_id
      AND is_active = TRUE
);
""";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);
        var result = await cmd.ExecuteScalarAsync(ct);
        if (result is not bool exists || !exists)
        {
            throw new InvalidOperationException("Selected chairman must be an active internal user.");
        }
    }

    private static async Task EnsurePlanningCommitteeModuleGrantAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid internalUserId,
        Guid? updatedBy,
        CancellationToken ct)
    {
        const string updateSql = """
UPDATE identity.internal_module_grants
SET is_enabled = TRUE,
    updated_by = @p_updated_by,
    updated_at = NOW()
WHERE internal_user_id = @p_internal_user_id
  AND module_id = @p_module_id;
""";
        await using var updateCmd = new NpgsqlCommand(updateSql, conn, tx);
        updateCmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);
        updateCmd.Parameters.AddWithValue("p_module_id", NpgsqlDbType.Varchar, PlanningCommitteeModuleId);
        updateCmd.Parameters.AddWithValue("p_updated_by", NpgsqlDbType.Uuid, (object?)updatedBy ?? DBNull.Value);
        var affected = await updateCmd.ExecuteNonQueryAsync(ct);
        if (affected > 0)
        {
            return;
        }

        const string insertSql = """
INSERT INTO identity.internal_module_grants (
    grant_id,
    role_id,
    internal_user_id,
    module_id,
    is_enabled,
    updated_by,
    created_at,
    updated_at
)
VALUES (
    gen_random_uuid(),
    NULL,
    @p_internal_user_id,
    @p_module_id,
    TRUE,
    @p_updated_by,
    NOW(),
    NOW()
);
""";
        await using var insertCmd = new NpgsqlCommand(insertSql, conn, tx);
        insertCmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, internalUserId);
        insertCmd.Parameters.AddWithValue("p_module_id", NpgsqlDbType.Varchar, PlanningCommitteeModuleId);
        insertCmd.Parameters.AddWithValue("p_updated_by", NpgsqlDbType.Uuid, (object?)updatedBy ?? DBNull.Value);
        await insertCmd.ExecuteNonQueryAsync(ct);
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

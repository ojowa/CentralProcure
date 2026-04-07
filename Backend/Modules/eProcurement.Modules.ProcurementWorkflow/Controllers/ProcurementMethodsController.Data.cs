using eProcurement.Modules.ProcurementWorkflow.DTOs;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class ProcurementMethodsController
{
    private async Task<Guid> InsertDecisionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        Guid? thresholdId,
        string? approvalRoute,
        string selectedMethod,
        string rationale,
        string? actor,
        bool isExceptionDecision,
        CancellationToken ct)
    {
        var nextDecisionId = Guid.NewGuid();

        const string supersedeSql = @"
UPDATE procurement_workflow.procurement_method_decisions
SET superseded_by_decision_id = @p_next_decision_id,
    updated_at = CURRENT_TIMESTAMP
WHERE entity_type = @p_entity_type
  AND entity_id = @p_entity_id
  AND superseded_by_decision_id IS NULL;";

        await using (var supersedeCmd = new NpgsqlCommand(supersedeSql, conn, tx))
        {
            supersedeCmd.Parameters.AddWithValue("p_next_decision_id", NpgsqlDbType.Uuid, nextDecisionId);
            supersedeCmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, NormalizeEntityType(entityType));
            supersedeCmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);
            await supersedeCmd.ExecuteNonQueryAsync(ct);
        }

        const string insertSql = @"
INSERT INTO procurement_workflow.procurement_method_decisions (
    decision_id,
    entity_type,
    entity_id,
    threshold_id,
    approval_route,
    selected_method,
    decision_reason,
    determined_by,
    is_exception_decision
)
VALUES (
    @p_decision_id,
    @p_entity_type,
    @p_entity_id,
    @p_threshold_id,
    @p_approval_route,
    @p_selected_method,
    @p_decision_reason,
    @p_determined_by,
    @p_is_exception_decision
);";

        await using var insertCmd = new NpgsqlCommand(insertSql, conn, tx);
        insertCmd.Parameters.AddWithValue("p_decision_id", NpgsqlDbType.Uuid, nextDecisionId);
        insertCmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, NormalizeEntityType(entityType));
        insertCmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);
        insertCmd.Parameters.AddWithValue("p_threshold_id", NpgsqlDbType.Uuid, (object?)thresholdId ?? DBNull.Value);
        insertCmd.Parameters.AddWithValue("p_approval_route", NpgsqlDbType.Varchar, (object?)approvalRoute ?? DBNull.Value);
        insertCmd.Parameters.AddWithValue("p_selected_method", NpgsqlDbType.Varchar, selectedMethod);
        insertCmd.Parameters.AddWithValue("p_decision_reason", NpgsqlDbType.Text, rationale);
        insertCmd.Parameters.AddWithValue("p_determined_by", NpgsqlDbType.Varchar, (object?)actor ?? DBNull.Value);
        insertCmd.Parameters.AddWithValue("p_is_exception_decision", NpgsqlDbType.Boolean, isExceptionDecision);
        await insertCmd.ExecuteNonQueryAsync(ct);

        return nextDecisionId;
    }

    private static async Task<RuntimeDetail?> GetRuntimeAsync(
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
    sc.stage_title AS current_stage_title,
    wi.record_title,
    wi.parent_entity_type,
    wi.parent_entity_id,
    wi.amount,
    wi.procurement_type,
    wi.threshold_id
FROM procurement_workflow.workflow_instances wi
JOIN procurement_workflow.workflow_stage_catalog sc
    ON sc.stage_key = wi.current_stage_key
WHERE wi.entity_type = @p_entity_type
  AND wi.entity_id = @p_entity_id
FOR UPDATE OF wi;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, NormalizeEntityType(entityType));
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new RuntimeDetail(
            reader.GetString(reader.GetOrdinal("entity_type")),
            reader.GetGuid(reader.GetOrdinal("entity_id")),
            reader.GetString(reader.GetOrdinal("current_stage_key")),
            reader.GetString(reader.GetOrdinal("current_stage_title")),
            GetNullableString(reader, "record_title"),
            GetNullableString(reader, "parent_entity_type"),
            GetNullableGuid(reader, "parent_entity_id"),
            GetNullableDecimal(reader, "amount"),
            GetNullableString(reader, "procurement_type"),
            GetNullableGuid(reader, "threshold_id"));
    }

    private static async Task<ProcurementMethodDecisionDto?> GetCurrentDecisionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT decision_id, selected_method, decision_reason, determined_by, determined_at, is_exception_decision
FROM procurement_workflow.procurement_method_decisions
WHERE entity_type = @p_entity_type
  AND entity_id = @p_entity_id
  AND superseded_by_decision_id IS NULL
ORDER BY determined_at DESC
LIMIT 1;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, NormalizeEntityType(entityType));
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new ProcurementMethodDecisionDto(
            reader.GetGuid(reader.GetOrdinal("decision_id")),
            reader.GetString(reader.GetOrdinal("selected_method")),
            reader.GetString(reader.GetOrdinal("decision_reason")),
            GetNullableString(reader, "determined_by"),
            reader.GetDateTime(reader.GetOrdinal("determined_at")),
            reader.GetBoolean(reader.GetOrdinal("is_exception_decision")));
    }

    private static async Task<ProcurementMethodExceptionDto?> GetActiveExceptionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT exception_id, current_method, requested_method, request_reason, requested_by, requested_at, status, cgis_note, reviewed_by, reviewed_at
FROM procurement_workflow.procurement_method_change_exceptions
WHERE entity_type = @p_entity_type
  AND entity_id = @p_entity_id
  AND status IN ('PendingReview', 'ReturnedForClarification')
ORDER BY requested_at DESC
LIMIT 1;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, NormalizeEntityType(entityType));
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);
        return await ReadExceptionSingleAsync(cmd, ct);
    }

    private static async Task<IReadOnlyList<ProcurementMethodExceptionDto>> GetRecentExceptionsAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT exception_id, current_method, requested_method, request_reason, requested_by, requested_at, status, cgis_note, reviewed_by, reviewed_at
FROM procurement_workflow.procurement_method_change_exceptions
WHERE entity_type = @p_entity_type
  AND entity_id = @p_entity_id
ORDER BY requested_at DESC
LIMIT 5;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, NormalizeEntityType(entityType));
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<ProcurementMethodExceptionDto>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(MapException(reader));
        }

        return results;
    }

    private static async Task<MethodExceptionRow?> GetExceptionByIdAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid exceptionId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT exception_id, entity_type, entity_id, current_method, requested_method, request_reason, status
FROM procurement_workflow.procurement_method_change_exceptions
WHERE exception_id = @p_exception_id
FOR UPDATE;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_exception_id", NpgsqlDbType.Uuid, exceptionId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new MethodExceptionRow(
            reader.GetGuid(reader.GetOrdinal("exception_id")),
            reader.GetString(reader.GetOrdinal("entity_type")),
            reader.GetGuid(reader.GetOrdinal("entity_id")),
            reader.GetString(reader.GetOrdinal("current_method")),
            reader.GetString(reader.GetOrdinal("requested_method")),
            reader.GetString(reader.GetOrdinal("request_reason")),
            reader.GetString(reader.GetOrdinal("status")));
    }

    private static async Task<ProcurementMethodExceptionDto?> ReadExceptionSingleAsync(NpgsqlCommand cmd, CancellationToken ct)
    {
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return MapException(reader);
    }

    private static ProcurementMethodExceptionDto MapException(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("exception_id")),
            reader.GetString(reader.GetOrdinal("current_method")),
            reader.GetString(reader.GetOrdinal("requested_method")),
            reader.GetString(reader.GetOrdinal("request_reason")),
            GetNullableString(reader, "requested_by"),
            reader.GetDateTime(reader.GetOrdinal("requested_at")),
            reader.GetString(reader.GetOrdinal("status")),
            GetNullableString(reader, "cgis_note"),
            GetNullableString(reader, "reviewed_by"),
            GetNullableDateTime(reader, "reviewed_at"));

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

    private static decimal? GetNullableDecimal(NpgsqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? null : reader.GetFieldValue<decimal>(ordinal);
    }

    private static DateTime? GetNullableDateTime(NpgsqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
    }
}

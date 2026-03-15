using System.Data;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class RequisitionsController
{
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

    private static RequisitionSummary MapSummary(NpgsqlDataReader r)
        => new(
            r.GetGuid(r.GetOrdinal("requisition_id")),
            r.GetString(r.GetOrdinal("title")),
            r.GetString(r.GetOrdinal("department")),
            GetNullableGuid(r, "unit_id"),
            r.GetString(r.GetOrdinal("status")),
            GetNullableString(r, "priority"),
            GetNullableString(r, "funding_source"),
            r.GetFieldValue<decimal>(r.GetOrdinal("total_estimate")),
            GetNullableDateTime(r, "required_by"),
            r.GetDateTime(r.GetOrdinal("created_at")));

    private static RequisitionDetail MapDetailWithoutItems(NpgsqlDataReader r)
        => new(
            r.GetGuid(r.GetOrdinal("requisition_id")),
            r.GetString(r.GetOrdinal("title")),
            r.GetString(r.GetOrdinal("department")),
            GetNullableGuid(r, "unit_id"),
            r.GetString(r.GetOrdinal("status")),
            GetNullableString(r, "priority"),
            GetNullableString(r, "funding_source"),
            r.GetFieldValue<decimal>(r.GetOrdinal("total_estimate")),
            GetNullableDateTime(r, "required_by"),
            r.GetDateTime(r.GetOrdinal("created_at")),
            GetNullableString(r, "procurement_type"),
            GetNullableString(r, "budget_code"),
            GetNullableGuid(r, "app_item_id"),
            GetNullableString(r, "project_code"),
            GetNullableString(r, "delivery_location"),
            GetNullableString(r, "justification"),
            GetNullableString(r, "risk_notes"),
            new List<RequisitionLineItemDto>(),
            r.GetDateTime(r.GetOrdinal("updated_at")),
            GetNullableString(r, "current_stage"));

    private static RequisitionLineItemDto MapLineItem(NpgsqlDataReader r)
        => new(
            GetNullableString(r, "item_code"),
            r.GetString(r.GetOrdinal("description")),
            r.GetString(r.GetOrdinal("unit")),
            r.GetFieldValue<decimal>(r.GetOrdinal("quantity")),
            r.GetFieldValue<decimal>(r.GetOrdinal("unit_cost")));

    private static async Task<List<RequisitionLineItemDto>> GetLineItemsAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid requisitionId,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("procurement_workflow.get_requisition_line_items_sp", conn, tx)
        {
            CommandType = CommandType.StoredProcedure
        };

        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

        return await ExecuteRefcursorAsync(cmd, MapLineItem, ct);
    }

    private static async Task<long> GetRequisitionCountAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string? status,
        string? department,
        string? priority,
        string? query,
        DateTime? dateFrom,
        DateTime? dateTo,
        CancellationToken ct)
    {
        const string sql = "SELECT procurement_workflow.get_requisitions_count(@p_status, @p_department, @p_priority, @p_query, @p_date_from, @p_date_to);";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)department ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_priority", NpgsqlDbType.Varchar, (object?)priority ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_date_from", NpgsqlDbType.Timestamp, (object?)dateFrom ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_date_to", NpgsqlDbType.Timestamp, (object?)dateTo ?? DBNull.Value);

        var result = await cmd.ExecuteScalarAsync(ct);
        return result is null ? 0 : Convert.ToInt64(result);
    }

    private static async Task<RequisitionWorkflowContext?> GetRequisitionWorkflowContextAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid requisitionId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT total_estimate, procurement_type
FROM procurement_workflow.requisitions
WHERE requisition_id = @p_requisition_id;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new RequisitionWorkflowContext(
            reader.IsDBNull(reader.GetOrdinal("total_estimate")) ? null : reader.GetFieldValue<decimal>(reader.GetOrdinal("total_estimate")),
            GetNullableString(reader, "procurement_type"));
    }

    private static int GetOptionalOrdinal(NpgsqlDataReader r, string n)
    {
        for (var i = 0; i < r.FieldCount; i++)
        {
            if (string.Equals(r.GetName(i), n, StringComparison.OrdinalIgnoreCase))
            {
                return i;
            }
        }

        return -1;
    }

    private static string? GetNullableString(NpgsqlDataReader r, string n)
    {
        var ordinal = GetOptionalOrdinal(r, n);
        if (ordinal < 0 || r.IsDBNull(ordinal))
        {
            return null;
        }

        return r.GetString(ordinal);
    }

    private static DateTime? GetNullableDateTime(NpgsqlDataReader r, string n)
    {
        var ordinal = GetOptionalOrdinal(r, n);
        if (ordinal < 0 || r.IsDBNull(ordinal))
        {
            return null;
        }

        return r.GetDateTime(ordinal);
    }

    private static Guid? GetNullableGuid(NpgsqlDataReader r, string n)
    {
        var ordinal = GetOptionalOrdinal(r, n);
        if (ordinal < 0 || r.IsDBNull(ordinal))
        {
            return null;
        }

        return r.GetGuid(ordinal);
    }

    private sealed record RequisitionWorkflowContext(decimal? TotalEstimate, string? ProcurementType);
}

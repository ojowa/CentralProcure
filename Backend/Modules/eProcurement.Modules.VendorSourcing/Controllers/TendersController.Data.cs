using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.VendorSourcing.DTOs;

namespace eProcurement.Modules.VendorSourcing.Controllers;

public partial class TendersController
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

    private static TenderSummary MapTenderSummary(NpgsqlDataReader r) => new(
        r.GetGuid(r.GetOrdinal("tender_id")),
        r.GetString(r.GetOrdinal("title")),
        r.GetString(r.GetOrdinal("category")),
        r.GetString(r.GetOrdinal("status")),
        GetNullableDecimal(r, "budget"),
        GetNullableString(r, "department"),
        GetNullableString(r, "budget_code"),
        GetNullableInt(r, "fiscal_year"),
        GetNullableDateTime(r, "publish_date"),
        GetNullableDateTime(r, "opening_date"),
        GetNullableDateTime(r, "closing_date"),
        r.GetDateTime(r.GetOrdinal("created_at")));

    private static TenderDetail MapTenderDetail(NpgsqlDataReader r) => new(
        r.GetGuid(r.GetOrdinal("tender_id")),
        r.GetString(r.GetOrdinal("title")),
        r.GetString(r.GetOrdinal("description")),
        r.GetString(r.GetOrdinal("category")),
        r.GetString(r.GetOrdinal("status")),
        GetNullableDecimal(r, "budget"),
        GetNullableString(r, "department"),
        GetNullableString(r, "budget_code"),
        GetNullableInt(r, "fiscal_year"),
        GetNullableString(r, "specifications"),
        GetNullableString(r, "eligibility_criteria"),
        GetNullableString(r, "evaluation_criteria"),
        GetNullableDateTime(r, "publish_date"),
        GetNullableDateTime(r, "opening_date"),
        GetNullableDateTime(r, "closing_date"),
        r.GetDateTime(r.GetOrdinal("created_at")),
        r.GetDateTime(r.GetOrdinal("updated_at")));

    private static string? GetNullableString(NpgsqlDataReader r, string n)
    {
        var ordinal = r.GetOrdinal(n);
        return r.IsDBNull(ordinal) ? null : r.GetString(ordinal);
    }

    private static DateTime? GetNullableDateTime(NpgsqlDataReader r, string n)
    {
        var ordinal = r.GetOrdinal(n);
        return r.IsDBNull(ordinal) ? null : r.GetDateTime(ordinal);
    }

    private static decimal? GetNullableDecimal(NpgsqlDataReader r, string n)
    {
        var ordinal = r.GetOrdinal(n);
        return r.IsDBNull(ordinal) ? null : r.GetFieldValue<decimal>(ordinal);
    }

    private static int? GetNullableInt(NpgsqlDataReader r, string n)
    {
        var ordinal = r.GetOrdinal(n);
        return r.IsDBNull(ordinal) ? null : r.GetInt32(ordinal);
    }

    private static async Task<long> GetTenderCountAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string? status,
        string? category,
        string? query,
        CancellationToken ct)
    {
        const string sql = "SELECT vendor_sourcing.get_tenders_count(@p_status, @p_category, @p_query);";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_category", NpgsqlDbType.Varchar, (object?)category ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);

        var result = await cmd.ExecuteScalarAsync(ct);
        return result is null ? 0 : Convert.ToInt64(result);
    }

    private static async Task<RequisitionSeed?> GetRequisitionSeedAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid requisitionId,
        CancellationToken ct)
    {
        const string sql = """
            SELECT requisition_id, title, department, total_estimate, required_by, created_at, procurement_type, budget_code, status
            FROM procurement_workflow.requisitions
            WHERE requisition_id = @p_requisition_id;
            """;

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, requisitionId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new RequisitionSeed(
            reader.GetGuid(reader.GetOrdinal("requisition_id")),
            reader.GetString(reader.GetOrdinal("title")),
            reader.GetString(reader.GetOrdinal("department")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("total_estimate")),
            GetNullableDateTime(reader, "required_by"),
            reader.GetDateTime(reader.GetOrdinal("created_at")),
            GetNullableString(reader, "procurement_type"),
            GetNullableString(reader, "budget_code"),
            reader.GetString(reader.GetOrdinal("status")));
    }

    private sealed record RequisitionSeed(
        Guid RequisitionId,
        string Title,
        string Department,
        decimal TotalEstimate,
        DateTime? RequiredBy,
        DateTime CreatedAt,
        string? ProcurementType,
        string? BudgetCode,
        string Status);
}

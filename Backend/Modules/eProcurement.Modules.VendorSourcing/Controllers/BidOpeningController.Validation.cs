using System.Data;
using eProcurement.Modules.VendorSourcing.DTOs;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.VendorSourcing.Controllers;

public partial class BidOpeningController
{
    private static string? ValidateCreateRequest(BidOpeningSessionCreateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = null;

        if (request.TenderId == Guid.Empty)
        {
            return "TenderId is required.";
        }

        if (string.IsNullOrWhiteSpace(request.SessionTitle) || request.SessionTitle.Trim().Length < 5)
        {
            return "SessionTitle must be at least 5 characters.";
        }

        if (request.ScheduledAt == default)
        {
            return "ScheduledAt is required.";
        }

        if (!IsStatusValid(request.Status, out normalizedStatus))
        {
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
        }

        if (request.OpenedAt.HasValue && request.OpenedAt.Value < request.ScheduledAt)
        {
            return "OpenedAt cannot be earlier than ScheduledAt.";
        }

        if (request.OpenedAt.HasValue && request.ClosedAt.HasValue && request.ClosedAt.Value < request.OpenedAt.Value)
        {
            return "ClosedAt cannot be earlier than OpenedAt.";
        }

        return null;
    }

    private static string? ValidateUpdateRequest(BidOpeningSessionUpdateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = null;

        var hasAny =
            request.SessionTitle is not null ||
            request.Location is not null ||
            request.ScheduledAt.HasValue ||
            request.Status is not null ||
            request.OpenedAt.HasValue ||
            request.ClosedAt.HasValue ||
            request.Notes is not null;

        if (!hasAny)
        {
            return "At least one field is required to update a session.";
        }

        if (request.SessionTitle is not null && request.SessionTitle.Trim().Length < 5)
        {
            return "SessionTitle must be at least 5 characters.";
        }

        if (!IsStatusValid(request.Status, out normalizedStatus))
        {
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
        }

        if (request.OpenedAt.HasValue && request.ScheduledAt.HasValue && request.OpenedAt.Value < request.ScheduledAt.Value)
        {
            return "OpenedAt cannot be earlier than ScheduledAt.";
        }

        if (request.OpenedAt.HasValue && request.ClosedAt.HasValue && request.ClosedAt.Value < request.OpenedAt.Value)
        {
            return "ClosedAt cannot be earlier than OpenedAt.";
        }

        return null;
    }

    private static async Task<long> GetSessionCountAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string? status,
        Guid? tenderId,
        string? query,
        DateTime? dateFrom,
        DateTime? dateTo,
        CancellationToken ct)
    {
        const string sql = "SELECT vendor_sourcing.get_bid_opening_sessions_count(@p_status, @p_tender_id, @p_query, @p_date_from, @p_date_to);";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, (object?)tenderId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_date_from", NpgsqlDbType.Timestamp, (object?)dateFrom ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_date_to", NpgsqlDbType.Timestamp, (object?)dateTo ?? DBNull.Value);

        var result = await cmd.ExecuteScalarAsync(ct);
        return result is null ? 0 : Convert.ToInt64(result);
    }
}

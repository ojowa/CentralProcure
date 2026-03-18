using System.Data;
using eProcurement.Modules.VendorSourcing.DTOs;
using eProcurement.Shared.Workflow;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.VendorSourcing.Controllers;

public partial class BidOpeningController
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

    private static BidOpeningSessionSummary MapSummary(NpgsqlDataReader r)
    {
        return new BidOpeningSessionSummary(
            r.GetGuid(r.GetOrdinal("session_id")),
            r.GetGuid(r.GetOrdinal("tender_id")),
            r.GetString(r.GetOrdinal("session_title")),
            GetNullableString(r, "location"),
            r.GetDateTime(r.GetOrdinal("scheduled_at")),
            r.GetString(r.GetOrdinal("status")),
            GetNullableDateTime(r, "opened_at"),
            GetNullableDateTime(r, "closed_at"),
            r.GetDateTime(r.GetOrdinal("created_at")));
    }

    private static BidOpeningSessionDetail MapDetail(NpgsqlDataReader r)
    {
        return new BidOpeningSessionDetail(
            r.GetGuid(r.GetOrdinal("session_id")),
            r.GetGuid(r.GetOrdinal("tender_id")),
            r.GetString(r.GetOrdinal("session_title")),
            GetNullableString(r, "location"),
            r.GetDateTime(r.GetOrdinal("scheduled_at")),
            r.GetString(r.GetOrdinal("status")),
            GetNullableDateTime(r, "opened_at"),
            GetNullableDateTime(r, "closed_at"),
            GetNullableString(r, "notes"),
            r.GetDateTime(r.GetOrdinal("created_at")),
            r.GetDateTime(r.GetOrdinal("updated_at")));
    }

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

    private static bool IsStatusValid(string? status, out string? normalized)
    {
        normalized = null;
        if (string.IsNullOrWhiteSpace(status))
        {
            return true;
        }

        var trimmed = status.Trim();
        var match = AllowedStatuses.FirstOrDefault(s => string.Equals(s, trimmed, StringComparison.OrdinalIgnoreCase));
        if (match is null)
        {
            return false;
        }

        normalized = match;
        return true;
    }

    private async Task SyncWorkflowRuntimeAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        BidOpeningSessionDetail session,
        string reason,
        CancellationToken ct)
    {
        await _workflowRuntimeTracker.SyncAsync(
            conn,
            tx,
            new WorkflowRuntimeSyncRequest(
                "bid_opening_session",
                session.SessionId,
                "bid_opening",
                session.Status,
                session.SessionTitle,
                "tender",
                session.TenderId,
                null,
                null,
                null,
                reason,
                null),
            ct);
    }

    private static string? ValidatePpaAlignedState(BidOpeningValidationState state, TenderScheduleContext tender)
    {
        if (!string.Equals(tender.Status, "Published", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(tender.Status, "Closed", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(tender.Status, "Awarded", StringComparison.OrdinalIgnoreCase))
        {
            return "Bid opening sessions can only be managed for tenders that have reached the published procurement stage.";
        }

        if (string.IsNullOrWhiteSpace(state.Location))
        {
            return "Location is required to support a public bid opening record.";
        }

        if (!tender.ClosingDate.HasValue)
        {
            return "Tender closing date must be defined before a bid opening session can be recorded.";
        }

        if (state.ScheduledAt < tender.ClosingDate.Value)
        {
            return "ScheduledAt cannot be earlier than the tender closing date.";
        }

        if (state.OpenedAt.HasValue && state.OpenedAt.Value < tender.ClosingDate.Value)
        {
            return "OpenedAt cannot be earlier than the tender closing date.";
        }

        switch (state.Status)
        {
            case "Scheduled":
                if (state.OpenedAt.HasValue || state.ClosedAt.HasValue)
                {
                    return "Scheduled sessions cannot carry opening or closing timestamps yet.";
                }
                break;
            case "Open":
                if (!state.OpenedAt.HasValue)
                {
                    return "OpenedAt is required once a bid opening session is marked Open.";
                }

                if (state.ClosedAt.HasValue)
                {
                    return "ClosedAt must remain empty while a bid opening session is still Open.";
                }
                break;
            case "Closed":
                if (!state.OpenedAt.HasValue || !state.ClosedAt.HasValue)
                {
                    return "Closed sessions must include both OpenedAt and ClosedAt.";
                }

                if (state.ClosedAt.Value < state.OpenedAt.Value)
                {
                    return "ClosedAt cannot be earlier than OpenedAt.";
                }
                break;
            case "Cancelled":
                if (state.OpenedAt.HasValue || state.ClosedAt.HasValue)
                {
                    return "Cancelled sessions cannot carry opening or closing timestamps.";
                }

                if (string.IsNullOrWhiteSpace(state.Notes))
                {
                    return "Cancellation notes are required for a cancelled bid opening session.";
                }
                break;
        }

        return null;
    }

    private static async Task<BidOpeningSessionDetail?> GetSessionDetailAsync(
        Guid sessionId,
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("vendor_sourcing.get_bid_opening_session_details_sp", conn, tx)
        {
            CommandType = CommandType.StoredProcedure
        };

        cmd.Parameters.AddWithValue("p_session_id", NpgsqlDbType.Uuid, sessionId);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
        {
            Direction = ParameterDirection.Output
        });

        var results = await ExecuteRefcursorAsync(cmd, MapDetail, ct);
        return results.FirstOrDefault();
    }

    private static async Task<TenderScheduleContext?> GetTenderScheduleAsync(
        Guid tenderId,
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("vendor_sourcing.get_tender_details_sp", conn, tx)
        {
            CommandType = CommandType.StoredProcedure
        };

        cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
        {
            Direction = ParameterDirection.Output
        });

        var results = await ExecuteRefcursorAsync(
            cmd,
            reader => new TenderScheduleContext(
                reader.GetGuid(reader.GetOrdinal("tender_id")),
                reader.GetString(reader.GetOrdinal("status")),
                GetNullableDateTime(reader, "opening_date"),
                GetNullableDateTime(reader, "closing_date")),
            ct);

        return results.FirstOrDefault();
    }
}

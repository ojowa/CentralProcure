using System.Security.Claims;
using eProcurement.Modules.VendorSourcing.DTOs;
using eProcurement.Shared.Workflow;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.VendorSourcing.Controllers;

public partial class TendersController
{
    private async Task EnsureBidOpeningSessionSeededAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        TenderDetail tender,
        CancellationToken ct)
    {
        var scheduledAt = ResolveBidOpeningScheduledAt(tender.OpeningDate, tender.ClosingDate);
        if (!scheduledAt.HasValue)
        {
            return;
        }

        if (await BidOpeningSessionExistsAsync(conn, tx, tender.TenderId, ct))
        {
            return;
        }

        var actor = User.FindFirstValue(ClaimTypes.Email) ??
                    User.FindFirstValue(ClaimTypes.Name) ??
                    User.Identity?.Name;

        var created = await CreateBidOpeningSessionSeedAsync(conn, tx, tender, scheduledAt.Value, actor, ct);
        if (created is null)
        {
            return;
        }

        await _workflowRuntimeTracker.SyncAsync(
            conn,
            tx,
            new WorkflowRuntimeSyncRequest(
                "bid_opening_session",
                created.SessionId,
                "bid_opening",
                created.Status,
                created.SessionTitle,
                "tender",
                tender.TenderId,
                tender.Budget,
                tender.Category,
                null,
                "Bid opening session auto-created from tender publication schedule.",
                actor,
                "tender_publish_auto_seed"),
            ct);
    }

    private static DateTime? ResolveBidOpeningScheduledAt(DateTime? openingDate, DateTime? closingDate)
    {
        if (openingDate.HasValue && closingDate.HasValue)
        {
            return openingDate.Value >= closingDate.Value ? openingDate.Value : closingDate.Value;
        }

        return openingDate ?? closingDate;
    }

    private static async Task<bool> BidOpeningSessionExistsAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid tenderId,
        CancellationToken ct)
    {
        const string sql = """
SELECT EXISTS(
    SELECT 1
    FROM vendor_sourcing.bid_opening_sessions
    WHERE tender_id = @p_tender_id
);
""";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is bool exists && exists;
    }

    private static async Task<SeededBidOpeningSession?> CreateBidOpeningSessionSeedAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        TenderDetail tender,
        DateTime scheduledAt,
        string? actor,
        CancellationToken ct)
    {
        const string sql = """
INSERT INTO vendor_sourcing.bid_opening_sessions (
    tender_id,
    session_title,
    location,
    scheduled_at,
    status,
    notes,
    created_by,
    updated_by
)
VALUES (
    @p_tender_id,
    @p_session_title,
    @p_location,
    @p_scheduled_at,
    'Scheduled',
    @p_notes,
    @p_actor,
    @p_actor
)
RETURNING session_id, session_title, status;
""";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tender.TenderId);
        cmd.Parameters.AddWithValue("p_session_title", NpgsqlDbType.Varchar, $"Bid Opening for {tender.Title}");
        cmd.Parameters.AddWithValue("p_location", NpgsqlDbType.Varchar, "Public bid opening venue to be confirmed");
        cmd.Parameters.AddWithValue("p_scheduled_at", NpgsqlDbType.Timestamp, scheduledAt);
        cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, "Auto-created from tender publication schedule.");
        cmd.Parameters.AddWithValue("p_actor", NpgsqlDbType.Varchar, (object?)actor ?? DBNull.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new SeededBidOpeningSession(
            reader.GetGuid(reader.GetOrdinal("session_id")),
            reader.GetString(reader.GetOrdinal("session_title")),
            reader.GetString(reader.GetOrdinal("status")));
    }

    private sealed record SeededBidOpeningSession(
        Guid SessionId,
        string SessionTitle,
        string Status);
}

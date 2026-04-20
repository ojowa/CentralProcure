using System.Data;
using eProcurement.Modules.Identity.DTOs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Identity.Services;

public sealed class NotificationService : INotificationService
{
    private readonly IConfiguration _config;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(IConfiguration config, ILogger<NotificationService> logger)
    {
        _config = config;
        _logger = logger;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? throw new InvalidOperationException("Primary connection string not found.");

    public async Task CreateNotificationAsync(Guid recipientUserId, string title, string message, string type, string? actionUrl = null, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new NpgsqlConnection(GetConnectionString());
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand("identity.create_internal_notification_sp", conn)
            {
                CommandType = CommandType.StoredProcedure
            };
            cmd.Parameters.AddWithValue("p_recipient_user_id", NpgsqlDbType.Uuid, recipientUserId);
            cmd.Parameters.AddWithValue("p_title", NpgsqlDbType.Varchar, title);
            cmd.Parameters.AddWithValue("p_message", NpgsqlDbType.Text, message);
            cmd.Parameters.AddWithValue("p_notification_type", NpgsqlDbType.Varchar, type);
            cmd.Parameters.AddWithValue("p_action_url", NpgsqlDbType.Text, (object?)actionUrl ?? DBNull.Value);

            await cmd.ExecuteNonQueryAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating notification for user {UserId}", recipientUserId);
        }
    }

    public async Task<List<InternalNotificationResult>> GetUserNotificationsAsync(Guid userId, int limit, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("identity.get_internal_notifications_sp", conn, tx)
        {
            CommandType = CommandType.StoredProcedure
        };
        cmd.Parameters.AddWithValue("p_user_id", NpgsqlDbType.Uuid, userId);
        cmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, limit);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

        var results = new List<InternalNotificationResult>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct))
        {
            var cursorName = reader.GetString(0);
            await using var fetchCmd = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", conn, tx);
            await using var cursorReader = await fetchCmd.ExecuteReaderAsync(ct);
            while (await cursorReader.ReadAsync(ct))
            {
                results.Add(new InternalNotificationResult(
                    cursorReader.GetGuid(0),
                    cursorReader.GetString(1),
                    cursorReader.GetString(2),
                    cursorReader.GetString(3),
                    cursorReader.GetBoolean(4),
                    cursorReader.GetDateTime(5),
                    cursorReader.IsDBNull(6) ? null : cursorReader.GetDateTime(6),
                    cursorReader.IsDBNull(7) ? null : cursorReader.GetString(7)
                ));
            }
        }
        await tx.CommitAsync(ct);
        return results;
    }

    public async Task MarkAsReadAsync(Guid notificationId, Guid userId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("identity.mark_notification_as_read_sp", conn)
        {
            CommandType = CommandType.StoredProcedure
        };
        cmd.Parameters.AddWithValue("p_notification_id", NpgsqlDbType.Uuid, notificationId);
        cmd.Parameters.AddWithValue("p_user_id", NpgsqlDbType.Uuid, userId);

        await cmd.ExecuteNonQueryAsync(ct);
    }
}

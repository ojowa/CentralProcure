using eProcurement.Modules.Identity.DTOs;

namespace eProcurement.Modules.Identity.Services;

public interface INotificationService
{
    Task CreateNotificationAsync(Guid recipientUserId, string title, string message, string type, string? actionUrl = null, CancellationToken ct = default);
    Task<List<InternalNotificationResult>> GetUserNotificationsAsync(Guid userId, int limit, CancellationToken ct);
    Task MarkAsReadAsync(Guid notificationId, Guid userId, CancellationToken ct);
}

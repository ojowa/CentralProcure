using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eProcurement.Modules.Identity.Controllers;

public partial class AuthController
{
    [Authorize]
    [HttpGet("internal/notifications")]
    public async Task<IActionResult> GetUserNotifications([FromQuery] int limit = 50, CancellationToken ct = default)
    {
        if (!TryGetAuthenticatedInternalUserId(out var userId, out var authError))
        {
            return authError!;
        }

        try
        {
            var results = await _notificationService.GetUserNotificationsAsync(userId, limit, ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error fetching notifications for user {UserId}", userId);
            return Problem("Internal server error.");
        }
    }

    [Authorize]
    [HttpPut("internal/notifications/{notificationId:guid}/read")]
    public async Task<IActionResult> MarkNotificationAsRead(Guid notificationId, CancellationToken ct = default)
    {
        if (!TryGetAuthenticatedInternalUserId(out var userId, out var authError))
        {
            return authError!;
        }

        try
        {
            await _notificationService.MarkAsReadAsync(notificationId, userId, ct);
            return NoContent();
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error marking notification {NotificationId} as read for user {UserId}", notificationId, userId);
            return Problem("Internal server error.");
        }
    }
}

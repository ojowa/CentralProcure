using System.Security.Claims;
using eProcurement.Shared.Configurations;
using eProcurement.Shared.Security;
using Microsoft.Extensions.Options;

namespace eProcurement.Shared.Middleware;

public sealed class InternalSessionIdleTimeoutMiddleware
{
    private const string InternalAuthCookieName = "internalAuthToken";

    private readonly RequestDelegate _next;
    private readonly ILogger<InternalSessionIdleTimeoutMiddleware> _logger;
    private readonly InternalSessionActivityProtector _activityProtector;
    private readonly InternalSessionOptions _options;

    public InternalSessionIdleTimeoutMiddleware(
        RequestDelegate next,
        ILogger<InternalSessionIdleTimeoutMiddleware> logger,
        InternalSessionActivityProtector activityProtector,
        IOptions<InternalSessionOptions> options)
    {
        _next = next;
        _logger = logger;
        _activityProtector = activityProtector;
        _options = options.Value;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!RequiresInternalIdleTracking(context, out var internalUserId))
        {
            await _next(context);
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var timeout = TimeSpan.FromMinutes(Math.Max(1, _options.IdleTimeoutMinutes));
        var activityCookieName = ResolveActivityCookieName();
        var activityCookie = context.Request.Cookies[activityCookieName];

        if (!string.IsNullOrWhiteSpace(activityCookie))
        {
            if (!_activityProtector.TryUnprotect(activityCookie, out var cookieUserId, out var lastActivityAtUtc) ||
                cookieUserId != internalUserId)
            {
                _logger.LogWarning("Rejected internal session for {Path}: activity cookie was invalid.", context.Request.Path);
                await RejectAndClearAsync(context, activityCookieName, "Internal session validation failed.");
                return;
            }

            if (now - lastActivityAtUtc > timeout)
            {
                _logger.LogInformation("Rejected internal session for {Path}: idle timeout exceeded for user {UserId}.", context.Request.Path, internalUserId);
                await RejectAndClearAsync(context, activityCookieName, "Internal session expired due to inactivity.");
                return;
            }
        }
        else
        {
             // If activity cookie is missing but JWT is valid, we allow it but we'll set the cookie in the response
             _logger.LogInformation("Internal session activity cookie missing for {Path}, will re-issue.", context.Request.Path);
        }

        await _next(context);

        if (context.Response.HasStarted || !RequiresInternalIdleTracking(context, out internalUserId))
        {
            return;
        }

        var protectedActivity = _activityProtector.Protect(internalUserId, now);
        context.Response.Cookies.Append(activityCookieName, protectedActivity, BuildCookieOptions(context, now.Add(timeout)));
    }

    private bool RequiresInternalIdleTracking(HttpContext context, out Guid internalUserId)
    {
        internalUserId = Guid.Empty;

        // Only track if the auth cookie is present
        if (!context.Request.Cookies.ContainsKey(InternalAuthCookieName))
        {
            return false;
        }

        if (IsExemptPath(context.Request.Path))
        {
            return false;
        }

        if (context.User.Identity?.IsAuthenticated != true)
        {
            return false;
        }

        var role = context.User.FindFirstValue("role") ?? context.User.FindFirstValue(ClaimTypes.Role);
        if (string.Equals(role, "vendor", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var userIdValue = context.User.FindFirst("sub")?.Value ??
                          context.User.FindFirstValue(ClaimTypes.NameIdentifier);

        return Guid.TryParse(userIdValue, out internalUserId);
    }

    private static bool IsExemptPath(PathString path)
    {
        return path.StartsWithSegments("/api/Auth/internal/login", StringComparison.OrdinalIgnoreCase)
               || path.StartsWithSegments("/api/Auth/internal/logout", StringComparison.OrdinalIgnoreCase);
    }

    private string ResolveActivityCookieName()
        => string.IsNullOrWhiteSpace(_options.ActivityCookieName)
            ? InternalSessionOptions.DefaultActivityCookieName
            : _options.ActivityCookieName.Trim();

    private static CookieOptions BuildCookieOptions(HttpContext context, DateTimeOffset expiresAtUtc)
    {
        return new CookieOptions
        {
            HttpOnly = true,
            Secure = ShouldUseSecureCookies(context.Request),
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = expiresAtUtc.UtcDateTime
        };
    }

    private static bool ShouldUseSecureCookies(HttpRequest request)
    {
        if (request.IsHttps)
        {
            return true;
        }

        return string.Equals(
            request.Headers["X-Forwarded-Proto"].ToString(),
            "https",
            StringComparison.OrdinalIgnoreCase);
    }

    private static async Task RejectAndClearAsync(HttpContext context, string activityCookieName, string message)
    {
        var deleteOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = ShouldUseSecureCookies(context.Request),
            SameSite = SameSiteMode.Lax,
            Path = "/"
        };

        context.Response.Cookies.Delete(InternalAuthCookieName, deleteOptions);
        context.Response.Cookies.Delete(activityCookieName, deleteOptions);
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { message });
    }
}

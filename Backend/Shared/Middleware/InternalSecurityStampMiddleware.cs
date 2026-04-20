using System.Security.Claims;
using Npgsql;

namespace eProcurement.Shared.Middleware;

/// <summary>
/// Middleware to validate the 'security_stamp' claim in the JWT against the database.
/// If a user's role is changed, the security stamp is refreshed in the DB, 
/// rendering the old JWT invalid for real-time security enforcement.
/// </summary>
public sealed class InternalSecurityStampMiddleware
{
    private const string InternalAuthCookieName = "internalAuthToken";
    private readonly RequestDelegate _next;
    private readonly IConfiguration _config;
    private readonly ILogger<InternalSecurityStampMiddleware> _logger;

    public InternalSecurityStampMiddleware(
        RequestDelegate next,
        IConfiguration config,
        ILogger<InternalSecurityStampMiddleware> logger)
    {
        _next = next;
        _config = config;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // 1. Skip if not authenticated or if it's a vendor (vendors don't use security stamps yet)
        if (context.User.Identity?.IsAuthenticated != true)
        {
            await _next(context);
            return;
        }

        var role = context.User.FindFirstValue("role") ?? context.User.FindFirstValue(ClaimTypes.Role);
        if (string.Equals(role, "vendor", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        // 2. Resolve User ID and Security Stamp from Claims
        var userIdClaim = context.User.FindFirst("sub")?.Value ?? context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var stampClaim = context.User.FindFirstValue("security_stamp");

        if (!Guid.TryParse(userIdClaim, out var userId) || string.IsNullOrWhiteSpace(stampClaim))
        {
            // If claims are missing, we can't validate. For safety in internal app, reject.
            await RejectAsync(context, "Invalid security context.");
            return;
        }

        // 3. Check against Database
        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            _logger.LogError("Database connection string is missing in SecurityStampMiddleware.");
            await _next(context); // Fallback to avoid complete lockout if DB is down? Or reject? Let's allow for now but log.
            return;
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(
                "SELECT security_stamp FROM identity.internal_users WHERE internal_user_id = @p_id AND is_active = TRUE", 
                conn);
            cmd.Parameters.AddWithValue("p_id", userId);

            var dbStamp = await cmd.ExecuteScalarAsync() as string;

            if (dbStamp == null || !string.Equals(dbStamp, stampClaim, StringComparison.Ordinal))
            {
                _logger.LogWarning("Security stamp mismatch for user {UserId}. Session invalidated.", userId);
                await RejectAsync(context, "Your session has been invalidated due to a security or role update. Please log in again.");
                return;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating security stamp for user {UserId}", userId);
            // On DB error, we might want to allow the request to proceed to avoid total downtime,
            // or reject for maximum security. Given this is NIS, we'll favor security.
            await RejectAsync(context, "Security validation error. Please try again later.");
            return;
        }

        await _next(context);
    }

    private async Task RejectAsync(HttpContext context, string message)
    {
        var secure = context.Request.IsHttps || string.Equals(context.Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);
        
        var deleteOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Lax,
            Path = "/"
        };

        context.Response.Cookies.Delete(InternalAuthCookieName, deleteOptions);
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { message });
    }
}

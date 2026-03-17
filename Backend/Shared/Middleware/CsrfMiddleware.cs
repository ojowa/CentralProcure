using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace eProcurement.Shared.Middleware;

public sealed class CsrfMiddleware
{
    private const string CsrfCookieName = "XSRF-TOKEN";
    private const string CsrfHeaderName = "X-CSRF-Token";
    private const string AuthorizationHeaderName = "Authorization";
    private const string BearerPrefix = "Bearer ";

    private readonly RequestDelegate _next;
    private readonly ILogger<CsrfMiddleware> _logger;

    public CsrfMiddleware(RequestDelegate next, ILogger<CsrfMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (IsSafeMethod(context.Request.Method) || IsExemptPath(context.Request.Path) || HasBearerAuthorization(context))
        {
            await _next(context);
            return;
        }

        var cookieToken = context.Request.Cookies[CsrfCookieName];
        var headerToken = context.Request.Headers[CsrfHeaderName].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(cookieToken) || string.IsNullOrWhiteSpace(headerToken))
        {
            _logger.LogWarning(
                "Rejected request for {Path}: missing CSRF cookie or header.",
                context.Request.Path);
            await RejectAsync(context);
            return;
        }

        if (!TokensMatch(cookieToken, headerToken))
        {
            _logger.LogWarning(
                "Rejected request for {Path}: CSRF cookie/header mismatch.",
                context.Request.Path);
            await RejectAsync(context);
            return;
        }

        await _next(context);
    }

    private static bool IsSafeMethod(string method)
    {
        return HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method);
    }

    private static bool HasBearerAuthorization(HttpContext context)
    {
        var authorization = context.Request.Headers[AuthorizationHeaderName].FirstOrDefault();
        return !string.IsNullOrWhiteSpace(authorization)
               && authorization.StartsWith(BearerPrefix, StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsExemptPath(PathString path)
    {
        if (!path.HasValue)
        {
            return false;
        }

        return path.StartsWithSegments("/api/Auth/login", StringComparison.OrdinalIgnoreCase)
               || path.StartsWithSegments("/api/Auth/internal/login", StringComparison.OrdinalIgnoreCase)
               || path.StartsWithSegments("/api/Auth/register", StringComparison.OrdinalIgnoreCase)
               || path.StartsWithSegments("/api/Auth/internal/register", StringComparison.OrdinalIgnoreCase);
    }

    private static bool TokensMatch(string cookieToken, string headerToken)
    {
        var cookieBytes = Encoding.UTF8.GetBytes(cookieToken);
        var headerBytes = Encoding.UTF8.GetBytes(headerToken);
        return cookieBytes.Length == headerBytes.Length
               && CryptographicOperations.FixedTimeEquals(cookieBytes, headerBytes);
    }

    private static async Task RejectAsync(HttpContext context)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { message = "CSRF token validation failed." });
    }
}

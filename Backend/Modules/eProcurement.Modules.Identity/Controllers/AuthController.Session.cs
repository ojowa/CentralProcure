using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using eProcurement.Shared.Configurations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace eProcurement.Modules.Identity.Controllers;

public partial class AuthController
{
    [Authorize]
    [HttpGet("me")]
    public IActionResult Me()
    {
        var userId = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        var email = User.FindFirst(JwtRegisteredClaimNames.Email)?.Value;
        var role = User.FindFirst("role")?.Value;

        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        return Ok(new
        {
            UserId = userId,
            Email = email,
            Role = role
        });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        DeleteAuthCookie(VendorAuthCookieName);
        return Ok(new { message = "Logged out successfully" });
    }

    [Authorize]
    [HttpPost("internal/logout")]
    public IActionResult InternalLogout()
    {
        DeleteAuthCookie(InternalAuthCookieName);
        DeleteInternalSessionActivityCookie();
        return Ok(new { message = "Logged out successfully" });
    }

    private void SetAuthCookie(string cookieName, string token)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = ShouldUseSecureCookies(),
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = DateTime.UtcNow.AddHours(24)
        };
        Response.Cookies.Append(cookieName, token, cookieOptions);
    }

    private void DeleteAuthCookie(string cookieName)
    {
        Response.Cookies.Delete(cookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = ShouldUseSecureCookies(),
            SameSite = SameSiteMode.Strict,
            Path = "/"
        });
    }

    private void SetInternalSessionActivityCookie(Guid internalUserId)
    {
        var timeout = TimeSpan.FromMinutes(Math.Max(1, _internalSessionOptions.IdleTimeoutMinutes));
        var activityCookieName = ResolveInternalSessionActivityCookieName();
        var protectedValue = _internalSessionActivityProtector.Protect(internalUserId, DateTimeOffset.UtcNow);

        Response.Cookies.Append(activityCookieName, protectedValue, new CookieOptions
        {
            HttpOnly = true,
            Secure = ShouldUseSecureCookies(),
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = DateTime.UtcNow.Add(timeout)
        });
    }

    private void DeleteInternalSessionActivityCookie()
    {
        Response.Cookies.Delete(ResolveInternalSessionActivityCookieName(), new CookieOptions
        {
            HttpOnly = true,
            Secure = ShouldUseSecureCookies(),
            SameSite = SameSiteMode.Strict,
            Path = "/"
        });
    }

    private string ResolveInternalSessionActivityCookieName()
    {
        return string.IsNullOrWhiteSpace(_internalSessionOptions.ActivityCookieName)
            ? InternalSessionOptions.DefaultActivityCookieName
            : _internalSessionOptions.ActivityCookieName.Trim();
    }

    private bool ShouldUseSecureCookies()
    {
        if (Request.IsHttps)
        {
            return true;
        }

        return string.Equals(
            Request.Headers["X-Forwarded-Proto"].ToString(),
            "https",
            StringComparison.OrdinalIgnoreCase);
    }

    private string GenerateToken(Guid userId, string email, string role)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            throw new InvalidOperationException("A role is required to issue an authentication token.");
        }

        var jwtSettings = new JwtSettings();
        Config.GetSection("Jwt").Bind(jwtSettings);

        var key = string.IsNullOrEmpty(jwtSettings.Key) ? "YourSuperSecretKeyWithAtLeast32Characters!" : jwtSettings.Key;
        var issuer = string.IsNullOrEmpty(jwtSettings.Issuer) ? "nis-eproc-identity" : jwtSettings.Issuer;
        var audience = string.IsNullOrEmpty(jwtSettings.Audience) ? "nis-eproc-clients" : jwtSettings.Audience;
        var durationMinutes = jwtSettings.DurationInMinutes <= 0 ? 1440 : jwtSettings.DurationInMinutes;

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim("role", role)
        };

        var creds = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(durationMinutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private bool TryGetAuthenticatedInternalUserId(out Guid internalUserId, out IActionResult? errorResult)
    {
        internalUserId = Guid.Empty;
        errorResult = null;

        var userIdValue = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userIdValue))
        {
            errorResult = Unauthorized(new { message = "Authenticated user id is missing." });
            return false;
        }

        if (!Guid.TryParse(userIdValue, out internalUserId))
        {
            errorResult = Unauthorized(new { message = "Authenticated user id is invalid." });
            return false;
        }

        return true;
    }
}

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
        DeleteCsrfCookie();
        return Ok(new { message = "Logged out successfully" });
    }

    [AllowAnonymous]
    [HttpGet("csrf")]
    public IActionResult GetCsrfToken()
    {
        SetCsrfCookie();
        return Ok(new { message = "CSRF token set." });
    }

    private void SetAuthCookie(string cookieName, string token)
    {
        var secure = ShouldUseSecureCookies();
        var isInternal = string.Equals(cookieName, InternalAuthCookieName, StringComparison.OrdinalIgnoreCase);
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            // Use Lax for internal app if possible; use None for cross-site if required for vendors
            SameSite = isInternal ? SameSiteMode.Lax : (secure ? SameSiteMode.None : SameSiteMode.Lax),
            Path = "/",
            Expires = DateTime.UtcNow.AddHours(24)
        };
        Response.Cookies.Append(cookieName, token, cookieOptions);
        
        SetCsrfCookie();
    }

    private void DeleteAuthCookie(string cookieName)
    {
        var secure = ShouldUseSecureCookies();
        Response.Cookies.Delete(cookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Lax,
            Path = "/"
        });
        DeleteCsrfCookie();
    }

    private void SetCsrfCookie()
    {
        var secure = ShouldUseSecureCookies();
        var token = Guid.NewGuid().ToString("N");
        var cookieOptions = new CookieOptions
        {
            HttpOnly = false, // Must be readable by frontend JS
            Secure = secure,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = DateTime.UtcNow.AddHours(24)
        };
        Response.Cookies.Append("XSRF-TOKEN", token, cookieOptions);
    }

    private void DeleteCsrfCookie()
    {
        var secure = ShouldUseSecureCookies();
        Response.Cookies.Delete("XSRF-TOKEN", new CookieOptions
        {
            HttpOnly = false,
            Secure = secure,
            SameSite = SameSiteMode.Lax,
            Path = "/"
        });
    }

    private void SetInternalSessionActivityCookie(Guid internalUserId)
    {
        var secure = ShouldUseSecureCookies();
        var timeout = TimeSpan.FromMinutes(Math.Max(1, _internalSessionOptions.IdleTimeoutMinutes));
        var activityCookieName = ResolveInternalSessionActivityCookieName();
        var protectedValue = _internalSessionActivityProtector.Protect(internalUserId, DateTimeOffset.UtcNow);

        Response.Cookies.Append(activityCookieName, protectedValue, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = DateTime.UtcNow.Add(timeout)
        });
    }

    private void DeleteInternalSessionActivityCookie()
    {
        var secure = ShouldUseSecureCookies();
        Response.Cookies.Delete(ResolveInternalSessionActivityCookieName(), new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Lax,
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
}

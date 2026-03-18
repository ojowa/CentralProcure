using GovernanceModule = eProcurement.Modules.Governance.ModuleMarker;
using IdentityModule = eProcurement.Modules.Identity.ModuleMarker;
using PostAwardModule = eProcurement.Modules.PostAward.ModuleMarker;
using ProcurementWorkflowModule = eProcurement.Modules.ProcurementWorkflow.ModuleMarker;
using VendorSourcingModule = eProcurement.Modules.VendorSourcing.ModuleMarker;
using System.Text;
using eProcurement.Shared.Workflow;
using eProcurement.Shared.Configurations;
using eProcurement.Shared.Middleware;
using eProcurement.Shared.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var renderPort = Environment.GetEnvironmentVariable("PORT");
const string FrontendCorsPolicy = "FrontendOrigins";
const string VendorAuthCookieName = "vendorAuthToken";
const string InternalAuthCookieName = "internalAuthToken";
const string DefaultDevelopmentUrl = "http://127.0.0.1:5080";

var configuredUrls = builder.Configuration["Server:Urls"]?.Trim();

if (!string.IsNullOrWhiteSpace(renderPort))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{renderPort}");
}
else if (!string.IsNullOrWhiteSpace(configuredUrls))
{
    builder.WebHost.UseUrls(configuredUrls);
}
else if (builder.Environment.IsDevelopment())
{
    builder.WebHost.UseUrls(DefaultDevelopmentUrl);
}

// --- Logging ---
builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(options =>
{
    options.TimestampFormat = "yyyy-MM-dd HH:mm:ss ";
    options.SingleLine = true;
});

// --- Controllers ---
var mvcBuilder = builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = null;
    });

mvcBuilder.AddApplicationPart(typeof(IdentityModule).Assembly);
mvcBuilder.AddApplicationPart(typeof(VendorSourcingModule).Assembly);
mvcBuilder.AddApplicationPart(typeof(ProcurementWorkflowModule).Assembly);
mvcBuilder.AddApplicationPart(typeof(PostAwardModule).Assembly);
mvcBuilder.AddApplicationPart(typeof(GovernanceModule).Assembly);

var dataProtectionKeysPath = builder.Configuration["DataProtection:KeysPath"];
if (string.IsNullOrWhiteSpace(dataProtectionKeysPath))
{
    dataProtectionKeysPath = Path.Combine(builder.Environment.ContentRootPath, ".data-protection-keys");
}
else if (!Path.IsPathRooted(dataProtectionKeysPath))
{
    dataProtectionKeysPath = Path.Combine(builder.Environment.ContentRootPath, dataProtectionKeysPath);
}

Directory.CreateDirectory(dataProtectionKeysPath);

builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath))
    .SetApplicationName(builder.Configuration["DataProtection:ApplicationName"]?.Trim() ?? "CentralProcure");

builder.Services.AddHealthChecks();
builder.Services.AddScoped<WorkflowPolicyGuard>();
builder.Services.AddScoped<WorkflowRuntimeTracker>();
builder.Services.AddScoped<WorkflowActionGrantService>();
builder.Services.Configure<InternalSessionOptions>(builder.Configuration.GetSection(InternalSessionOptions.SectionName));
builder.Services.AddSingleton<InternalSessionActivityProtector>();
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// --- Authentication & Authorization ---
var jwtSettings = new JwtSettings();
builder.Configuration.GetSection("Jwt").Bind(jwtSettings);
ValidateJwtSettings(jwtSettings);

var jwtKey = jwtSettings.Key.Trim();
var jwtIssuer = jwtSettings.Issuer.Trim();
var jwtAudience = jwtSettings.Audience.Trim();

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .GetChildren()
    .Select(section => section.Value?.Trim())
    .Where(value => !string.IsNullOrWhiteSpace(value))
    .Cast<string>()
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

if (allowedOrigins.Length == 0)
{
    throw new InvalidOperationException("Cors:AllowedOrigins must contain at least one explicit origin.");
}

builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };

    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var authorization = context.Request.Headers.Authorization.FirstOrDefault();
            if (TryResolveBearerToken(authorization, out var bearerToken))
            {
                context.Token = bearerToken;
                return Task.CompletedTask;
            }

            context.Token = ResolveCookieToken(context.Request);
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

var app = builder.Build();

// --- Middleware ---
app.UseForwardedHeaders();
app.UseMiddleware<ExceptionMiddleware>();
app.UseMiddleware<CsrfMiddleware>();

app.UseHttpsRedirection();
app.UseCors(FrontendCorsPolicy);
app.UseAuthentication();
app.UseMiddleware<InternalSessionIdleTimeoutMiddleware>();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health").AllowAnonymous();

app.Run();

static void ValidateJwtSettings(JwtSettings settings)
{
    if (string.IsNullOrWhiteSpace(settings.Key))
    {
        throw new InvalidOperationException("Jwt:Key is required and must not be empty.");
    }

    if (Encoding.UTF8.GetByteCount(settings.Key.Trim()) < 32)
    {
        throw new InvalidOperationException("Jwt:Key must be at least 32 bytes long.");
    }

    if (string.IsNullOrWhiteSpace(settings.Issuer))
    {
        throw new InvalidOperationException("Jwt:Issuer is required and must not be empty.");
    }

    if (string.IsNullOrWhiteSpace(settings.Audience))
    {
        throw new InvalidOperationException("Jwt:Audience is required and must not be empty.");
    }

    if (settings.DurationInMinutes <= 0)
    {
        throw new InvalidOperationException("Jwt:DurationInMinutes must be greater than zero.");
    }
}

static bool TryResolveBearerToken(string? authorization, out string? token)
{
    token = null;
    if (string.IsNullOrWhiteSpace(authorization) || !authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
    {
        return false;
    }

    var candidate = authorization["Bearer ".Length..].Trim();
    if (string.IsNullOrWhiteSpace(candidate) || candidate.Count(character => character == '.') != 2)
    {
        return false;
    }

    token = candidate;
    return true;
}

static string? ResolveCookieToken(HttpRequest request)
{
    if (UsesVendorCookie(request.Path))
    {
        return request.Cookies[VendorAuthCookieName];
    }

    if (UsesInternalCookie(request.Path))
    {
        return request.Cookies[InternalAuthCookieName];
    }

    return request.Cookies[InternalAuthCookieName] ?? request.Cookies[VendorAuthCookieName];
}

static bool UsesVendorCookie(PathString path)
{
    return path.StartsWithSegments("/api/Auth/me", StringComparison.OrdinalIgnoreCase)
        || path.StartsWithSegments("/api/Auth/logout", StringComparison.OrdinalIgnoreCase)
        || path.StartsWithSegments("/api/Vendor", StringComparison.OrdinalIgnoreCase)
        || path.StartsWithSegments("/api/vendors", StringComparison.OrdinalIgnoreCase)
        || path.StartsWithSegments("/api/Tender", StringComparison.OrdinalIgnoreCase)
        || path.StartsWithSegments("/api/tenders", StringComparison.OrdinalIgnoreCase)
        || path.StartsWithSegments("/api/bids", StringComparison.OrdinalIgnoreCase);
}

static bool UsesInternalCookie(PathString path)
{
    return path.StartsWithSegments("/api/Auth/internal", StringComparison.OrdinalIgnoreCase);
}

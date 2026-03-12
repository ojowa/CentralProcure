using GovernanceModule = eProcurement.Modules.Governance.ModuleMarker;
using IdentityModule = eProcurement.Modules.Identity.ModuleMarker;
using PostAwardModule = eProcurement.Modules.PostAward.ModuleMarker;
using ProcurementWorkflowModule = eProcurement.Modules.ProcurementWorkflow.ModuleMarker;
using VendorSourcingModule = eProcurement.Modules.VendorSourcing.ModuleMarker;
using eProcurement.Shared.Configurations;
using eProcurement.Shared.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);
var renderPort = Environment.GetEnvironmentVariable("PORT");

if (!string.IsNullOrWhiteSpace(renderPort))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{renderPort}");
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

builder.Services.AddHealthChecks();
builder.Services.AddCors();
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// --- Authentication & Authorization ---
var jwtSettings = new JwtSettings();
builder.Configuration.GetSection("Jwt").Bind(jwtSettings);

var jwtKey = string.IsNullOrEmpty(jwtSettings.Key) ? "YourSuperSecretKeyWithAtLeast32Characters!" : jwtSettings.Key;
var jwtIssuer = string.IsNullOrEmpty(jwtSettings.Issuer) ? "nis-eproc-identity" : jwtSettings.Issuer;
var jwtAudience = string.IsNullOrEmpty(jwtSettings.Audience) ? "nis-eproc-clients" : jwtSettings.Audience;

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
});

builder.Services.AddAuthorization();

var app = builder.Build();

// --- Middleware ---
app.UseForwardedHeaders();
app.UseMiddleware<ExceptionMiddleware>();
app.UseMiddleware<CsrfMiddleware>();

app.UseHttpsRedirection();
app.UseCors(policy => policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.MapGet("/api/_migration/status", () => Results.Ok(new
{
    service = "e-procurement-backend",
    phase = "merged",
    message = "Unified backend host online."
}));

app.Run();

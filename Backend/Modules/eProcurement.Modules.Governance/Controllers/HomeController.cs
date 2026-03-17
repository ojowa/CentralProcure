using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace eProcurement.Modules.Governance.Controllers;

[ApiController]
[Route("")]
public class HomeController : ControllerBase
{
    private readonly ILogger<HomeController> _logger;
    private readonly IConfiguration _config;

    public HomeController(ILogger<HomeController> logger, IConfiguration config)
    {
        _logger = logger;
        _config = config;
    }

    [HttpGet]
    public IActionResult Root()
    {
        var serviceName = _config["SERVICE_NAME"] ?? "governance-service";
        _logger.LogInformation("{ServiceName} root endpoint was called.", serviceName);
        return Ok(new
        {
            service = serviceName,
            status = "running"
        });
    }

    [AllowAnonymous]
    [HttpGet("health")]
    public IActionResult Health()
    {
        var serviceName = _config["SERVICE_NAME"] ?? "governance-service";
        return Ok(new
        {
            service = serviceName,
            status = "healthy",
            utc = DateTime.UtcNow
        });
    }

    [HttpGet("api/_migration/status")]
    public IActionResult MigrationStatus()
    {
        var serviceName = _config["SERVICE_NAME"] ?? "governance-service";
        return Ok(new
        {
            service = serviceName,
            phase = "restructured",
            message = "Program.cs restructured to follow standardized template."
        });
    }
}

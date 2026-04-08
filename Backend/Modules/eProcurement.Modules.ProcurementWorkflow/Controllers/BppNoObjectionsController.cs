using Microsoft.AspNetCore.Mvc;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Modules.ProcurementWorkflow.Services;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/bpp-no-objections")]
public class BppNoObjectionsController : ControllerBase
{
    private readonly ILogger<BppNoObjectionsController> _logger;
    private readonly IBppNoObjectionService _bppService;

    public BppNoObjectionsController(ILogger<BppNoObjectionsController> logger, IBppNoObjectionService bppService)
    {
        _logger = logger;
        _bppService = bppService;
    }

    [HttpGet]
    public async Task<IActionResult> GetNoObjections([FromQuery] Guid? requisitionId, [FromQuery] Guid? tenderId, [FromQuery] string? status, CancellationToken ct)
    {
        try
        {
            return Ok(await _bppService.GetNoObjectionsAsync(requisitionId, tenderId, status, ct));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving BPP no objection records.");
            return Problem("Internal server error.");
        }
    }

    [HttpGet("{noObjectionId:guid}")]
    public async Task<IActionResult> GetNoObjection(Guid noObjectionId, CancellationToken ct)
    {
        try
        {
            var result = await _bppService.GetNoObjectionAsync(noObjectionId, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving BPP no objection {NoObjectionId}.", noObjectionId);
            return Problem("Internal server error.");
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateNoObjection([FromBody] BppNoObjectionCreateRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _bppService.CreateNoObjectionAsync(request, User, ct);
            return Created($"/api/bpp-no-objections/{result.NoObjectionId}", result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating BPP no objection record.");
            return Problem("Internal server error.");
        }
    }

    [HttpPut("{noObjectionId:guid}")]
    public async Task<IActionResult> UpdateNoObjection(Guid noObjectionId, [FromBody] BppNoObjectionUpdateRequest request, CancellationToken ct)
    {
        try
        {
            return Ok(await _bppService.UpdateNoObjectionAsync(noObjectionId, request, User, ct));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating BPP no objection {NoObjectionId}.", noObjectionId);
            return Problem("Internal server error.");
        }
    }
}

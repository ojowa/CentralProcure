using Microsoft.AspNetCore.Mvc;
using eProcurement.Modules.PostAward.DTOs;
using eProcurement.Modules.PostAward.Services;

namespace eProcurement.Modules.PostAward.Controllers;

[ApiController]
[Route("api/inspections")]
public class InspectionsController : ControllerBase
{
    private readonly ILogger<InspectionsController> _logger;
    private readonly IInspectionService _inspectionService;

    public InspectionsController(
        ILogger<InspectionsController> logger,
        IInspectionService inspectionService)
    {
        _logger = logger;
        _inspectionService = inspectionService;
    }

    [HttpGet]
    public async Task<IActionResult> GetInspections([FromQuery] string? status, [FromQuery] string? query, CancellationToken ct)
    {
        try
        {
            var results = await _inspectionService.GetInspectionsAsync(status, query, ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting inspections.");
            return Problem("Internal server error retrieving inspections.");
        }
    }

    [HttpGet("{inspectionId}")]
    public async Task<IActionResult> GetInspection(string inspectionId, CancellationToken ct)
    {
        try
        {
            var result = await _inspectionService.GetInspectionAsync(inspectionId, ct);
            return result is null ? NotFound(new { message = "Inspection not found." }) : Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting inspection {InspectionId}.", inspectionId);
            return Problem("Internal server error retrieving inspection.");
        }
    }

    [HttpPut("{inspectionId}")]
    public async Task<IActionResult> UpdateInspection(string inspectionId, [FromBody] InspectionUpdateRequest request, CancellationToken ct)
    {
        try
        {
            var updated = await _inspectionService.UpdateInspectionAsync(inspectionId, request, User, ct);
            return Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating inspection {InspectionId}.", inspectionId);
            return Problem("Internal server error updating inspection.");
        }
    }
}

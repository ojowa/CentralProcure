using Microsoft.AspNetCore.Mvc;
using eProcurement.Modules.PostAward.DTOs;
using eProcurement.Modules.PostAward.Services;

namespace eProcurement.Modules.PostAward.Controllers;

[ApiController]
[Route("api/contracts")]
public class ContractsController : ControllerBase
{
    private readonly ILogger<ContractsController> _logger;
    private readonly IContractService _contractService;

    public ContractsController(
        ILogger<ContractsController> logger,
        IContractService contractService)
    {
        _logger = logger;
        _contractService = contractService;
    }

    [HttpGet]
    public async Task<IActionResult> GetContracts([FromQuery] string? status, [FromQuery] string? query, CancellationToken ct)
    {
        try
        {
            var results = await _contractService.GetContractsAsync(status, query, ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting contracts.");
            return Problem("Internal server error retrieving contracts.");
        }
    }

    [HttpGet("{contractId}")]
    public async Task<IActionResult> GetContract(string contractId, CancellationToken ct)
    {
        try
        {
            var result = await _contractService.GetContractAsync(contractId, ct);
            return result is null ? NotFound(new { message = "Contract not found." }) : Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting contract {ContractId}.", contractId);
            return Problem("Internal server error retrieving contract.");
        }
    }

    [HttpGet("{contractId}/milestones")]
    public async Task<IActionResult> GetContractMilestones(string contractId, CancellationToken ct)
    {
        try
        {
            var results = await _contractService.GetContractMilestonesAsync(contractId, ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting milestones for contract {ContractId}.", contractId);
            return Problem("Internal server error retrieving contract milestones.");
        }
    }

    [HttpPost("{contractId}/milestones")]
    public async Task<IActionResult> LogContractMilestone(
        string contractId,
        [FromBody] ContractMilestoneCreateRequest request,
        CancellationToken ct)
    {
        try
        {
            var result = await _contractService.LogContractMilestoneAsync(contractId, request, User, ct);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
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
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error logging milestone for contract {ContractId}.", contractId);
            return Problem("Internal server error logging contract milestone.");
        }
    }

    [HttpGet("awards")]
    public async Task<IActionResult> GetAwards([FromQuery] string? status, [FromQuery] string? query, CancellationToken ct)
    {
        try
        {
            var results = await _contractService.GetAwardsAsync(status, query, ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting contract awards.");
            return Problem("Internal server error retrieving contract awards.");
        }
    }

    [HttpGet("awards/{awardId}")]
    public async Task<IActionResult> GetAward(string awardId, CancellationToken ct)
    {
        try
        {
            var result = await _contractService.GetAwardAsync(awardId, ct);
            return result is null ? NotFound(new { message = "Award not found." }) : Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting award {AwardId}.", awardId);
            return Problem("Internal server error retrieving award.");
        }
    }

    [HttpPost("awards/{awardId}/publish")]
    public async Task<IActionResult> PublishAward(string awardId, CancellationToken ct)
    {
        try
        {
            var result = await _contractService.PublishAwardAsync(awardId, User, ct);
            return Ok(result);
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
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing award {AwardId}.", awardId);
            return Problem("Internal server error publishing award.");
        }
    }
}

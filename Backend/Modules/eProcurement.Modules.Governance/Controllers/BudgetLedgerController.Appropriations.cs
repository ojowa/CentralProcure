using eProcurement.Modules.Governance.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace eProcurement.Modules.Governance.Controllers;

public partial class BudgetLedgerController
{
    [Authorize]
    [HttpPost("appropriations")]
    public async Task<IActionResult> CreateBudgetAppropriation([FromBody] BudgetAppropriationCreateRequest request, CancellationToken ct)
    {
        if (!CanActAsBudgetOfficer()) return Forbid();

        if (request.FiscalYear <= 0) return BadRequest("Fiscal year must be a positive number.");
        if (string.IsNullOrWhiteSpace(request.Department)) return BadRequest("Department is required.");
        if (request.Department.Length > MaxDepartmentLength) return BadRequest($"Department must be {MaxDepartmentLength} characters or fewer.");
        if (string.IsNullOrWhiteSpace(request.BudgetCode)) return BadRequest("Budget code is required.");
        if (request.BudgetCode.Length > MaxBudgetCodeLength) return BadRequest($"Budget code must be {MaxBudgetCodeLength} characters or fewer.");
        if (request.Amount <= 0) return BadRequest("Amount must be greater than zero.");

        try
        {
            var response = await _budgetService.CreateAppropriationAsync(request, ct);
            return Ok(response);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error creating budget appropriation for {BudgetCode}.", request.BudgetCode);
            return Problem("Internal server error creating budget appropriation.");
        }
    }

    [Authorize]
    [HttpPost("releases")]
    public async Task<IActionResult> CreateBudgetRelease([FromBody] BudgetReleaseCreateRequest request, CancellationToken ct)
    {
        if (!CanActAsBudgetOfficer()) return Forbid();
        if (request.AppropriationId == Guid.Empty) return BadRequest("AppropriationId is required.");
        if (request.Amount <= 0) return BadRequest("Release amount must be greater than zero.");

        try
        {
            var response = await _budgetService.CreateReleaseAsync(request, ct);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error creating budget release for appropriation {AppropriationId}.", request.AppropriationId);
            return Problem("Internal server error creating budget release.");
        }
    }

    [Authorize]
    [HttpPost("appropriations/{id:guid}/close")]
    public async Task<IActionResult> CloseBudgetAppropriation([FromRoute] Guid id, CancellationToken ct)
    {
        if (!CanActAsBudgetOfficer()) return Forbid();
        if (id == Guid.Empty) return BadRequest("Appropriation ID is required.");

        try
        {
            var response = await _budgetService.CloseAppropriationAsync(id, ct);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error closing budget appropriation {AppropriationId}.", id);
            return Problem("Internal server error closing budget appropriation.");
        }
    }

    [Authorize]
    [HttpPost("commitments")]
    public async Task<IActionResult> CreateBudgetCommitment([FromBody] BudgetCommitmentCreateRequest request, CancellationToken ct)
    {
        if (!CanActAsBudgetOfficer()) return Forbid();
        if (request.AppropriationId == Guid.Empty) return BadRequest("AppropriationId is required.");
        if (request.Amount <= 0) return BadRequest("Commitment amount must be greater than zero.");

        try
        {
            var response = await _budgetService.CreateCommitmentAsync(request, ct);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error creating budget commitment for appropriation {AppropriationId}.", request.AppropriationId);
            return Problem("Internal server error creating budget commitment.");
        }
    }

    [Authorize]
    [HttpGet("commitments")]
    public async Task<IActionResult> GetBudgetCommitments(
        [FromQuery] Guid? appropriationId,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        CancellationToken ct = default)
    {
        if (page < 1) return BadRequest("Page must be 1 or greater.");
        if (pageSize < 1 || pageSize > MaxPageSize) return BadRequest($"PageSize must be between 1 and {MaxPageSize}.");

        try
        {
            var response = await _budgetService.GetCommitmentsAsync(appropriationId, status, page, pageSize, ct);
            return Ok(response);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error loading budget commitments.");
            return Problem("Internal server error loading budget commitments.");
        }
    }

    [Authorize]
    [HttpPost("commitments/{id:guid}/cancel")]
    public async Task<IActionResult> CancelBudgetCommitment(Guid id, CancellationToken ct)
    {
        if (!CanActAsBudgetOfficer()) return Forbid();

        try
        {
            var response = await _budgetService.CancelCommitmentAsync(id, ct);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error cancelling budget commitment {CommitmentId}.", id);
            return Problem("Internal server error cancelling budget commitment.");
        }
    }

    [Authorize]
    [HttpGet("releases")]
    public async Task<IActionResult> GetBudgetReleases(
        [FromQuery] Guid? appropriationId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        CancellationToken ct = default)
    {
        if (page < 1) return BadRequest("Page must be 1 or greater.");
        if (pageSize < 1 || pageSize > MaxPageSize) return BadRequest($"PageSize must be between 1 and {MaxPageSize}.");

        try
        {
            var response = await _budgetService.GetReleasesAsync(appropriationId, page, pageSize, ct);
            return Ok(response);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error loading budget releases.");
            return Problem("Internal server error loading budget releases.");
        }
    }

    [Authorize]
    [HttpGet("appropriations")]
    public async Task<IActionResult> GetBudgetAppropriations(
        [FromQuery] int? fiscalYear,
        [FromQuery] string? department,
        [FromQuery] string? budgetCode,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        CancellationToken ct = default)
    {
        if (page < 1) return BadRequest("Page must be 1 or greater.");
        if (pageSize < 1 || pageSize > MaxPageSize) return BadRequest($"PageSize must be between 1 and {MaxPageSize}.");
        if (department?.Length > MaxDepartmentLength) return BadRequest($"Department must be {MaxDepartmentLength} characters or fewer.");
        if (budgetCode?.Length > MaxBudgetCodeLength) return BadRequest($"Budget code must be {MaxBudgetCodeLength} characters or fewer.");

        try
        {
            var response = await _budgetService.GetAppropriationsAsync(fiscalYear, department, budgetCode, status, page, pageSize, ct);
            return Ok(response);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error loading budget appropriations.");
            return Problem("Internal server error loading budget appropriations.");
        }
    }
}

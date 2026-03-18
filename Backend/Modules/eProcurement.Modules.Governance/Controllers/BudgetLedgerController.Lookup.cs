using eProcurement.Modules.Governance.DTOs;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Governance.Controllers;

public partial class BudgetLedgerController
{
    [HttpGet("availability")]
    public async Task<IActionResult> GetAvailability(
        [FromQuery] string budgetCode,
        [FromQuery] string department,
        [FromQuery] int fiscalYear,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(budgetCode))
        {
            return BadRequest("BudgetCode is required.");
        }

        if (string.IsNullOrWhiteSpace(department))
        {
            return BadRequest("Department is required.");
        }

        if (budgetCode.Trim().Length > MaxBudgetCodeLength)
        {
            return BadRequest($"BudgetCode must be {MaxBudgetCodeLength} characters or fewer.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = "SELECT procurement_workflow.get_budget_available(@p_budget_code, @p_department, @p_fiscal_year);";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, budgetCode);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, department);
            cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, fiscalYear);

            var result = await cmd.ExecuteScalarAsync(ct);
            var available = result is null ? 0 : Convert.ToDecimal(result);
            return Ok(new BudgetAvailabilityResponse(available));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error getting budget availability for {BudgetCode}.", budgetCode);
            return Problem("Internal server error retrieving budget availability.");
        }
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        [FromQuery] string budgetCode,
        [FromQuery] string department,
        [FromQuery] int fiscalYear,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(budgetCode))
        {
            return BadRequest("BudgetCode is required.");
        }

        if (string.IsNullOrWhiteSpace(department))
        {
            return BadRequest("Department is required.");
        }

        if (budgetCode.Trim().Length > MaxBudgetCodeLength)
        {
            return BadRequest($"BudgetCode must be {MaxBudgetCodeLength} characters or fewer.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
WITH appropriation AS (
    SELECT COALESCE(SUM(a.amount), 0) AS appropriated
    FROM procurement_workflow.budget_appropriations a
    WHERE a.budget_code = @p_budget_code
      AND a.department = @p_department
      AND a.fiscal_year = @p_fiscal_year
      AND a.status = 'Active'
),
releases AS (
    SELECT COALESCE(SUM(r.amount), 0) AS released
    FROM procurement_workflow.budget_releases r
    JOIN procurement_workflow.budget_appropriations a ON a.appropriation_id = r.appropriation_id
    WHERE a.budget_code = @p_budget_code
      AND a.department = @p_department
      AND a.fiscal_year = @p_fiscal_year
      AND a.status = 'Active'
),
commitments AS (
    SELECT COALESCE(SUM(c.amount), 0) AS committed
    FROM procurement_workflow.budget_commitments c
    WHERE c.budget_code = @p_budget_code
      AND c.department = @p_department
      AND c.fiscal_year = @p_fiscal_year
      AND c.status IN ('Reserved', 'Committed')
),
expenditures AS (
    SELECT COALESCE(SUM(e.amount), 0) AS spent
    FROM procurement_workflow.budget_expenditures e
    JOIN procurement_workflow.budget_commitments c ON c.commitment_id = e.commitment_id
    WHERE c.budget_code = @p_budget_code
      AND c.department = @p_department
      AND c.fiscal_year = @p_fiscal_year
)
SELECT
    appropriated,
    released,
    committed,
    spent,
    (CASE WHEN released > 0 THEN released ELSE appropriated END) - committed - spent AS available
FROM appropriation, releases, commitments, expenditures;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, budgetCode);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, department);
            cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, fiscalYear);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return NotFound();
            }

            return Ok(new BudgetSummaryResponse(
                reader.GetDecimal(0),
                reader.GetDecimal(1),
                reader.GetDecimal(2),
                reader.GetDecimal(3),
                reader.GetDecimal(4)));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error getting budget summary for {BudgetCode}.", budgetCode);
            return Problem("Internal server error retrieving budget summary.");
        }
    }
}

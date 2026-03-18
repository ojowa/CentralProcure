using eProcurement.Modules.Governance.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.Governance.Controllers;

public partial class BudgetLedgerController
{
    [Authorize]
    [HttpPost("appropriations")]
    public async Task<IActionResult> CreateBudgetAppropriation([FromBody] BudgetAppropriationCreateRequest request, CancellationToken ct)
    {
        if (!CanActAsBudgetOfficer())
        {
            return Forbid();
        }

        var fiscalYear = request.FiscalYear;
        if (fiscalYear <= 0)
        {
            return BadRequest("Fiscal year must be a positive number.");
        }

        var department = NormalizeFilter(request.Department);
        if (string.IsNullOrWhiteSpace(department))
        {
            return BadRequest("Department is required.");
        }

        if (department.Length > MaxDepartmentLength)
        {
            return BadRequest($"Department must be {MaxDepartmentLength} characters or fewer.");
        }

        var budgetCode = NormalizeFilter(request.BudgetCode);
        if (string.IsNullOrWhiteSpace(budgetCode))
        {
            return BadRequest("Budget code is required.");
        }

        if (budgetCode.Length > MaxBudgetCodeLength)
        {
            return BadRequest($"Budget code must be {MaxBudgetCodeLength} characters or fewer.");
        }

        if (request.Amount <= 0)
        {
            return BadRequest("Amount must be greater than zero.");
        }

        var normalizedStatus = NormalizeFilter(request.Status) ?? "Active";
        normalizedStatus = normalizedStatus switch
        {
            var status when string.Equals(status, "Active", StringComparison.OrdinalIgnoreCase) => "Active",
            var status when string.Equals(status, "Closed", StringComparison.OrdinalIgnoreCase) => "Closed",
            _ => null
        };

        if (normalizedStatus is null)
        {
            return BadRequest("Status must be Active or Closed.");
        }

        var notes = NormalizeFilter(request.Notes);

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
INSERT INTO procurement_workflow.budget_appropriations (
    fiscal_year,
    department,
    budget_code,
    amount,
    status,
    notes
)
VALUES (
    @p_fiscal_year,
    @p_department,
    @p_budget_code,
    @p_amount,
    @p_status,
    @p_notes
)
RETURNING
    appropriation_id,
    fiscal_year,
    department,
    budget_code,
    amount,
    status,
    notes,
    created_at,
    updated_at;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, fiscalYear);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, department);
            cmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, budgetCode);
            cmd.Parameters.AddWithValue("p_amount", NpgsqlDbType.Numeric, request.Amount);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, normalizedStatus);
            cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)notes ?? DBNull.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return Problem("Budget appropriation could not be created.");
            }

            return Ok(new BudgetAppropriationResponse(
                reader.GetGuid(reader.GetOrdinal("appropriation_id")),
                reader.GetInt32(reader.GetOrdinal("fiscal_year")),
                reader.GetString(reader.GetOrdinal("department")),
                reader.GetString(reader.GetOrdinal("budget_code")),
                reader.GetDecimal(reader.GetOrdinal("amount")),
                reader.GetString(reader.GetOrdinal("status")),
                GetNullableString(reader, "notes"),
                reader.GetDateTime(reader.GetOrdinal("created_at")),
                reader.GetDateTime(reader.GetOrdinal("updated_at"))));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error creating budget appropriation for {BudgetCode}.", budgetCode);
            return Problem("Internal server error creating budget appropriation.");
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
        if (page < 1)
        {
            return BadRequest("Page must be 1 or greater.");
        }

        if (pageSize < 1 || pageSize > MaxPageSize)
        {
            return BadRequest($"PageSize must be between 1 and {MaxPageSize}.");
        }

        if (!string.IsNullOrWhiteSpace(department) && department.Trim().Length > MaxDepartmentLength)
        {
            return BadRequest($"Department must be {MaxDepartmentLength} characters or fewer.");
        }

        if (!string.IsNullOrWhiteSpace(budgetCode) && budgetCode.Trim().Length > MaxBudgetCodeLength)
        {
            return BadRequest($"Budget code must be {MaxBudgetCodeLength} characters or fewer.");
        }

        var normalizedStatus = NormalizeFilter(status);
        if (!string.IsNullOrWhiteSpace(normalizedStatus) &&
            !string.Equals(normalizedStatus, "Active", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(normalizedStatus, "Closed", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Status must be Active or Closed when supplied.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        var baseSql = @"
SELECT
    appropriation_id,
    fiscal_year,
    department,
    budget_code,
    amount,
    status,
    notes,
    created_at,
    updated_at
FROM procurement_workflow.budget_appropriations
WHERE (@p_fiscal_year IS NULL OR fiscal_year = @p_fiscal_year)
  AND (@p_department IS NULL OR department ILIKE '%' || @p_department || '%')
  AND (@p_budget_code IS NULL OR budget_code ILIKE '%' || @p_budget_code || '%')
  AND (@p_status IS NULL OR status = @p_status)";

        var countSql = $"SELECT COUNT(*) FROM ({baseSql}) q;";
        var itemSql = $"{baseSql} ORDER BY created_at DESC OFFSET @p_offset LIMIT @p_limit;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var countCmd = new NpgsqlCommand(countSql, conn);
            AddAppropriationFilters(countCmd, fiscalYear, department, budgetCode, normalizedStatus);
            var total = Convert.ToInt64(await countCmd.ExecuteScalarAsync(ct) ?? 0);

            await using var itemCmd = new NpgsqlCommand(itemSql, conn);
            AddAppropriationFilters(itemCmd, fiscalYear, department, budgetCode, normalizedStatus);
            itemCmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, (page - 1) * pageSize);
            itemCmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, pageSize);

            var items = new List<BudgetAppropriationResponse>();
            await using var reader = await itemCmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                items.Add(MapBudgetAppropriation(reader));
            }

            return Ok(new BudgetAppropriationListResponse(items, page, pageSize, total));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error loading budget appropriations.");
            return Problem("Internal server error loading budget appropriations.");
        }
    }

    private static void AddAppropriationFilters(
        NpgsqlCommand cmd,
        int? fiscalYear,
        string? department,
        string? budgetCode,
        string? status)
    {
        cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)fiscalYear ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)NormalizeFilter(department) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, (object?)NormalizeFilter(budgetCode) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
    }

    private static BudgetAppropriationResponse MapBudgetAppropriation(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("appropriation_id")),
            reader.GetInt32(reader.GetOrdinal("fiscal_year")),
            reader.GetString(reader.GetOrdinal("department")),
            reader.GetString(reader.GetOrdinal("budget_code")),
            reader.GetDecimal(reader.GetOrdinal("amount")),
            reader.GetString(reader.GetOrdinal("status")),
            GetNullableString(reader, "notes"),
            reader.GetDateTime(reader.GetOrdinal("created_at")),
            reader.GetDateTime(reader.GetOrdinal("updated_at")));
}

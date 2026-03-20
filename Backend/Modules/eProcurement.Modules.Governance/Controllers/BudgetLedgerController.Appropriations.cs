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
    [HttpPost("releases")]
    public async Task<IActionResult> CreateBudgetRelease([FromBody] BudgetReleaseCreateRequest request, CancellationToken ct)
    {
        if (!CanActAsBudgetOfficer())
        {
            return Forbid();
        }

        if (request.AppropriationId == Guid.Empty)
        {
            return BadRequest("AppropriationId is required.");
        }

        if (request.Amount <= 0)
        {
            return BadRequest("Release amount must be greater than zero.");
        }

        var notes = NormalizeFilter(request.Notes);
        var releaseDate = DateTime.SpecifyKind(request.ReleaseDate ?? DateTime.UtcNow, DateTimeKind.Unspecified);

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

const string sql = @"
WITH appropriation AS (
    SELECT appropriation_id, fiscal_year, department, budget_code, amount
    FROM procurement_workflow.budget_appropriations
    WHERE appropriation_id = @p_appropriation_id
      AND status = 'Active'
),
released AS (
    SELECT COALESCE(SUM(amount), 0) AS total_released
    FROM procurement_workflow.budget_releases
    WHERE appropriation_id = @p_appropriation_id
),
insert_release AS (
    INSERT INTO procurement_workflow.budget_releases (
        appropriation_id,
        amount,
        release_date,
        notes
    )
    SELECT
        @p_appropriation_id,
        @p_amount,
        @p_release_date,
        @p_notes
    FROM appropriation a
    CROSS JOIN released r
    WHERE (r.total_released + @p_amount) <= a.amount
    RETURNING release_id, appropriation_id, amount, release_date, notes, created_at, updated_at
)
SELECT
    ir.release_id,
    ir.appropriation_id,
    a.fiscal_year,
    a.department,
    a.budget_code,
    a.amount AS appropriation_amount,
    ir.amount,
    ir.release_date,
    ir.notes,
    ir.created_at,
    ir.updated_at
FROM insert_release ir
JOIN appropriation a
  ON a.appropriation_id = ir.appropriation_id;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_appropriation_id", NpgsqlDbType.Uuid, request.AppropriationId);
            cmd.Parameters.AddWithValue("p_amount", NpgsqlDbType.Numeric, request.Amount);
            cmd.Parameters.AddWithValue("p_release_date", NpgsqlDbType.Timestamp, releaseDate);
            cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)notes ?? DBNull.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return BadRequest("Release could not be recorded. Ensure the appropriation is active and the release does not exceed the appropriated amount.");
            }

            return Ok(new BudgetReleaseResponse(
                reader.GetGuid(reader.GetOrdinal("release_id")),
                reader.GetGuid(reader.GetOrdinal("appropriation_id")),
                reader.GetInt32(reader.GetOrdinal("fiscal_year")),
                reader.GetString(reader.GetOrdinal("department")),
                reader.GetString(reader.GetOrdinal("budget_code")),
                reader.GetDecimal(reader.GetOrdinal("appropriation_amount")),
                reader.GetDecimal(reader.GetOrdinal("amount")),
                reader.GetDateTime(reader.GetOrdinal("release_date")),
                GetNullableString(reader, "notes"),
                reader.GetDateTime(reader.GetOrdinal("created_at")),
                reader.GetDateTime(reader.GetOrdinal("updated_at"))));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error creating budget release for appropriation {AppropriationId}.", request.AppropriationId);
            return Problem("Internal server error creating budget release.");
        }
    }

    [Authorize]
    [HttpPost("appropriations/{id}/close")]
    public async Task<IActionResult> CloseBudgetAppropriation([FromRoute] Guid id, CancellationToken ct)
    {
        if (!CanActAsBudgetOfficer())
        {
            return Forbid();
        }

        if (id == Guid.Empty)
        {
            return BadRequest("Appropriation ID is required.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
UPDATE procurement_workflow.budget_appropriations
SET status = 'Closed',
    updated_at = NOW()
WHERE appropriation_id = @p_appropriation_id
  AND status = 'Active'
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
            cmd.Parameters.AddWithValue("p_appropriation_id", NpgsqlDbType.Uuid, id);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return NotFound(new { message = "Active appropriation not found or already closed." });
            }

            return Ok(MapBudgetAppropriation(reader));
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
        if (!CanActAsBudgetOfficer())
        {
            return Forbid();
        }

        if (request.AppropriationId == Guid.Empty)
        {
            return BadRequest("AppropriationId is required.");
        }

        if (request.Amount <= 0)
        {
            return BadRequest("Commitment amount must be greater than zero.");
        }

        var committedAt = DateTime.SpecifyKind(request.CommittedAt ?? DateTime.UtcNow, DateTimeKind.Unspecified);

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
WITH appropriation AS (
    SELECT appropriation_id, fiscal_year, department, budget_code, amount
    FROM procurement_workflow.budget_appropriations
    WHERE appropriation_id = @p_appropriation_id
      AND status = 'Active'
),
committed AS (
    SELECT COALESCE(SUM(amount), 0) AS total_committed
    FROM procurement_workflow.budget_commitments
    WHERE appropriation_id = @p_appropriation_id
),
insert_commitment AS (
    INSERT INTO procurement_workflow.budget_commitments (
        appropriation_id,
        fiscal_year,
        department,
        budget_code,
        amount,
        status,
        committed_at
    )
    SELECT
        @p_appropriation_id,
        a.fiscal_year,
        a.department,
        a.budget_code,
        @p_amount,
        'Committed',
        @p_committed_at
    FROM appropriation a
    CROSS JOIN committed c
    WHERE (c.total_committed + @p_amount) <= a.amount
    RETURNING commitment_id, appropriation_id, fiscal_year, department, budget_code, amount, status, committed_at, created_at, updated_at
)
SELECT
    ic.commitment_id,
    ic.appropriation_id,
    ic.fiscal_year,
    ic.department,
    ic.budget_code,
    a.amount AS appropriation_amount,
    ic.amount,
    ic.committed_at,
    ic.status,
    ic.created_at,
    ic.updated_at
FROM insert_commitment ic
JOIN appropriation a
  ON a.appropriation_id = ic.appropriation_id;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_appropriation_id", NpgsqlDbType.Uuid, request.AppropriationId);
            cmd.Parameters.AddWithValue("p_amount", NpgsqlDbType.Numeric, request.Amount);
            cmd.Parameters.AddWithValue("p_committed_at", NpgsqlDbType.Timestamp, committedAt);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return BadRequest("Commitment could not be recorded. Ensure the appropriation is active and the total commitments do not exceed the appropriation amount.");
            }

            return Ok(new BudgetCommitmentResponse(
                reader.GetGuid(reader.GetOrdinal("commitment_id")),
                reader.GetGuid(reader.GetOrdinal("appropriation_id")),
                null,
                null,
                null,
                reader.GetInt32(reader.GetOrdinal("fiscal_year")),
                reader.GetString(reader.GetOrdinal("department")),
                reader.GetString(reader.GetOrdinal("budget_code")),
                reader.GetDecimal(reader.GetOrdinal("appropriation_amount")),
                reader.GetDecimal(reader.GetOrdinal("amount")),
                reader.GetDateTime(reader.GetOrdinal("committed_at")),
                reader.GetString(reader.GetOrdinal("status")),
                reader.GetDateTime(reader.GetOrdinal("created_at")),
                reader.GetDateTime(reader.GetOrdinal("updated_at"))));
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
        if (page < 1)
        {
            return BadRequest("Page must be 1 or greater.");
        }

        if (pageSize < 1 || pageSize > MaxPageSize)
        {
            return BadRequest($"PageSize must be between 1 and {MaxPageSize}.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string baseSql = @"
SELECT
    c.commitment_id,
    c.appropriation_id,
    c.requisition_id,
    r.title AS requisition_title,
    r.status AS requisition_status,
    c.fiscal_year,
    c.department,
    c.budget_code,
    COALESCE(a.amount, ab.amount, 0) AS appropriation_amount,
    c.amount,
    c.status,
    c.committed_at,
    c.created_at,
    c.updated_at
FROM procurement_workflow.budget_commitments c
LEFT JOIN procurement_workflow.budget_appropriations a
  ON a.appropriation_id = c.appropriation_id
LEFT JOIN procurement_workflow.requisitions r
  ON r.requisition_id = c.requisition_id
LEFT JOIN procurement_workflow.budget_appropriations af
  ON af.appropriation_id = @p_appropriation_id
LEFT JOIN (
    SELECT
        budget_code,
        department,
        fiscal_year,
        SUM(amount) AS amount
    FROM procurement_workflow.budget_appropriations
    WHERE status = 'Active'
    GROUP BY budget_code, department, fiscal_year
) ab
  ON ab.budget_code = c.budget_code
 AND ab.department = c.department
 AND ab.fiscal_year = c.fiscal_year
WHERE (
        @p_appropriation_id IS NULL
        OR c.appropriation_id = @p_appropriation_id
        OR (
            af.appropriation_id IS NOT NULL
            AND c.appropriation_id IS NULL
            AND c.budget_code = af.budget_code
            AND c.department = af.department
            AND c.fiscal_year = af.fiscal_year
        )
    )
  AND (@p_status IS NULL OR c.status = @p_status)";

        var countSql = $"SELECT COUNT(*) FROM ({baseSql}) q;";
        var itemSql = $"{baseSql} ORDER BY c.committed_at DESC, c.created_at DESC OFFSET @p_offset LIMIT @p_limit;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var countCmd = new NpgsqlCommand(countSql, conn);
            countCmd.Parameters.AddWithValue("p_appropriation_id", NpgsqlDbType.Uuid, (object?)appropriationId ?? DBNull.Value);
            countCmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
            var total = Convert.ToInt64(await countCmd.ExecuteScalarAsync(ct) ?? 0);

            await using var itemCmd = new NpgsqlCommand(itemSql, conn);
            itemCmd.Parameters.AddWithValue("p_appropriation_id", NpgsqlDbType.Uuid, (object?)appropriationId ?? DBNull.Value);
            itemCmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
            itemCmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, (page - 1) * pageSize);
            itemCmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, pageSize);

            var items = new List<BudgetCommitmentResponse>();
            await using var reader = await itemCmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                items.Add(new BudgetCommitmentResponse(
                    reader.GetGuid(reader.GetOrdinal("commitment_id")),
                    GetNullableGuid(reader, "appropriation_id"),
                    GetNullableGuid(reader, "requisition_id"),
                    GetNullableString(reader, "requisition_title"),
                    GetNullableString(reader, "requisition_status"),
                    reader.GetInt32(reader.GetOrdinal("fiscal_year")),
                    reader.GetString(reader.GetOrdinal("department")),
                    reader.GetString(reader.GetOrdinal("budget_code")),
                    reader.GetDecimal(reader.GetOrdinal("appropriation_amount")),
                    reader.GetDecimal(reader.GetOrdinal("amount")),
                    reader.GetDateTime(reader.GetOrdinal("committed_at")),
                    reader.GetString(reader.GetOrdinal("status")),
                    reader.GetDateTime(reader.GetOrdinal("created_at")),
                    reader.GetDateTime(reader.GetOrdinal("updated_at"))));
            }

            return Ok(new BudgetCommitmentListResponse(items, page, pageSize, total));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error loading budget commitments.");
            return Problem("Internal server error loading budget commitments.");
        }
    }

    [Authorize]
    [HttpPost("commitments/{id}/cancel")]
    public async Task<IActionResult> CancelBudgetCommitment(Guid id, CancellationToken ct)
    {
        if (!CanActAsBudgetOfficer())
        {
            return Forbid();
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
UPDATE procurement_workflow.budget_commitments
SET status = 'Cancelled',
    updated_at = NOW()
WHERE commitment_id = @p_commitment_id
  AND status IN ('Reserved', 'Committed')
RETURNING commitment_id, appropriation_id, requisition_id, fiscal_year, department, budget_code, amount, status, committed_at, created_at, updated_at;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_commitment_id", NpgsqlDbType.Uuid, id);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return BadRequest("Commitment could not be cancelled. Ensure it exists and is in a cancellable state (Reserved or Committed).");
            }

            // Need appropriation amount for the response DTO
            var commitmentId = reader.GetGuid(reader.GetOrdinal("commitment_id"));
            var appropriationId = reader.GetGuid(reader.GetOrdinal("appropriation_id"));
            var requisitionId = GetNullableGuid(reader, "requisition_id");
            var fiscalYear = reader.GetInt32(reader.GetOrdinal("fiscal_year"));
            var department = reader.GetString(reader.GetOrdinal("department"));
            var budgetCode = reader.GetString(reader.GetOrdinal("budget_code"));
            var amount = reader.GetDecimal(reader.GetOrdinal("amount"));
            var committedAt = reader.GetDateTime(reader.GetOrdinal("committed_at"));
            var status = reader.GetString(reader.GetOrdinal("status"));
            var createdAt = reader.GetDateTime(reader.GetOrdinal("created_at"));
            var updatedAt = reader.GetDateTime(reader.GetOrdinal("updated_at"));
            await reader.CloseAsync();

            const string appSql = "SELECT amount FROM procurement_workflow.budget_appropriations WHERE appropriation_id = @p_id;";
            await using var appCmd = new NpgsqlCommand(appSql, conn);
            appCmd.Parameters.AddWithValue("p_id", NpgsqlDbType.Uuid, appropriationId);
            var appAmount = Convert.ToDecimal(await appCmd.ExecuteScalarAsync(ct) ?? 0);

            string? requisitionTitle = null;
            string? requisitionStatus = null;
            if (requisitionId.HasValue)
            {
                const string reqSql = "SELECT title, status FROM procurement_workflow.requisitions WHERE requisition_id = @p_req_id;";
                await using var reqCmd = new NpgsqlCommand(reqSql, conn);
                reqCmd.Parameters.AddWithValue("p_req_id", NpgsqlDbType.Uuid, requisitionId.Value);
                await using var reqReader = await reqCmd.ExecuteReaderAsync(ct);
                if (await reqReader.ReadAsync(ct))
                {
                    requisitionTitle = GetNullableString(reqReader, "title");
                    requisitionStatus = GetNullableString(reqReader, "status");
                }
            }

            return Ok(new BudgetCommitmentResponse(
                commitmentId,
                appropriationId,
                requisitionId,
                requisitionTitle,
                requisitionStatus,
                fiscalYear,
                department,
                budgetCode,
                appAmount,
                amount,
                committedAt,
                status,
                createdAt,
                updatedAt));
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
        if (page < 1)
        {
            return BadRequest("Page must be 1 or greater.");
        }

        if (pageSize < 1 || pageSize > MaxPageSize)
        {
            return BadRequest($"PageSize must be between 1 and {MaxPageSize}.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string baseSql = @"
SELECT
    r.release_id,
    r.appropriation_id,
    a.fiscal_year,
    a.department,
    a.budget_code,
    a.amount AS appropriation_amount,
    r.amount,
    r.release_date,
    r.notes,
    r.created_at,
    r.updated_at
FROM procurement_workflow.budget_releases r
JOIN procurement_workflow.budget_appropriations a
  ON a.appropriation_id = r.appropriation_id
WHERE (@p_appropriation_id IS NULL OR r.appropriation_id = @p_appropriation_id)";

        var countSql = $"SELECT COUNT(*) FROM ({baseSql}) q;";
        var itemSql = $"{baseSql} ORDER BY r.release_date DESC, r.created_at DESC OFFSET @p_offset LIMIT @p_limit;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            await using var countCmd = new NpgsqlCommand(countSql, conn);
            countCmd.Parameters.AddWithValue("p_appropriation_id", NpgsqlDbType.Uuid, (object?)appropriationId ?? DBNull.Value);
            var total = Convert.ToInt64(await countCmd.ExecuteScalarAsync(ct) ?? 0);

            await using var itemCmd = new NpgsqlCommand(itemSql, conn);
            itemCmd.Parameters.AddWithValue("p_appropriation_id", NpgsqlDbType.Uuid, (object?)appropriationId ?? DBNull.Value);
            itemCmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, (page - 1) * pageSize);
            itemCmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, pageSize);

            var items = new List<BudgetReleaseResponse>();
            await using var reader = await itemCmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                items.Add(new BudgetReleaseResponse(
                    reader.GetGuid(reader.GetOrdinal("release_id")),
                    reader.GetGuid(reader.GetOrdinal("appropriation_id")),
                    reader.GetInt32(reader.GetOrdinal("fiscal_year")),
                    reader.GetString(reader.GetOrdinal("department")),
                    reader.GetString(reader.GetOrdinal("budget_code")),
                    reader.GetDecimal(reader.GetOrdinal("appropriation_amount")),
                    reader.GetDecimal(reader.GetOrdinal("amount")),
                    reader.GetDateTime(reader.GetOrdinal("release_date")),
                    GetNullableString(reader, "notes"),
                    reader.GetDateTime(reader.GetOrdinal("created_at")),
                    reader.GetDateTime(reader.GetOrdinal("updated_at"))));
            }

            return Ok(new BudgetReleaseListResponse(items, page, pageSize, total));
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

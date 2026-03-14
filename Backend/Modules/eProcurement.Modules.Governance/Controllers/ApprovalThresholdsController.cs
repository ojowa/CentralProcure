using System.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.Governance.DTOs;
using eProcurement.Shared.Controllers;

namespace eProcurement.Modules.Governance.Controllers;

[ApiController]
[Route("api/approval-thresholds")]
public class ApprovalThresholdsController : BaseModuleController
{
    private static readonly string[] AllowedStatuses = { "Active", "Inactive" };

    public ApprovalThresholdsController(IConfiguration config, ILogger<ApprovalThresholdsController> logger)
        : base(config, logger)
    {
    }

    [HttpGet]
    public async Task<IActionResult> GetThresholds([FromQuery] string? status, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        if (!string.IsNullOrWhiteSpace(status) &&
            !AllowedStatuses.Any(s => s.Equals(status.Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            return BadRequest($"Status must be one of: {string.Join(", ", AllowedStatuses)}.");
        }

        const string sql = @"
SELECT
    threshold_id,
    procurement_type,
    min_amount,
    max_amount,
    approval_route,
    requires_board,
    requires_bpp,
    status,
    notes,
    created_at,
    updated_at
FROM procurement_workflow.approval_thresholds
WHERE (@p_status IS NULL OR status = @p_status)
ORDER BY min_amount ASC;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);

            var results = new List<ApprovalThresholdDetail>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                results.Add(MapThreshold(reader));
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error retrieving approval thresholds.");
            return Problem("Internal server error retrieving approval thresholds.");
        }
    }

    [HttpGet("resolve")]
    public async Task<IActionResult> ResolveThreshold([FromQuery] decimal amount, [FromQuery] string? procurementType, CancellationToken ct)
    {
        if (amount < 0)
        {
            return BadRequest("Amount must be 0 or greater.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
SELECT
    threshold_id,
    procurement_type,
    min_amount,
    max_amount,
    approval_route,
    requires_board,
    requires_bpp,
    status,
    notes,
    created_at,
    updated_at
FROM procurement_workflow.approval_thresholds
WHERE status = 'Active'
  AND min_amount <= @p_amount
  AND (max_amount IS NULL OR max_amount >= @p_amount)
  AND (
        @p_procurement_type IS NULL
        OR procurement_type IS NULL
        OR lower(procurement_type) = lower(@p_procurement_type)
      )
ORDER BY
    CASE
        WHEN @p_procurement_type IS NOT NULL AND procurement_type IS NOT NULL AND lower(procurement_type) = lower(@p_procurement_type) THEN 0
        WHEN procurement_type IS NULL THEN 1
        ELSE 2
    END,
    min_amount DESC
LIMIT 1;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_procurement_type", NpgsqlDbType.Varchar, (object?)procurementType ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_amount", NpgsqlDbType.Numeric, amount);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                return Ok(MapThreshold(reader));
            }

            return NotFound(new { message = "No matching threshold found for the given amount and type." });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error resolving threshold for amount {Amount}.", amount);
            return Problem("Internal server error resolving threshold.");
        }
    }

    private static ApprovalThresholdDetail MapThreshold(NpgsqlDataReader r)
    {
        return new ApprovalThresholdDetail(
            r.GetGuid(r.GetOrdinal("threshold_id")),
            GetNullableString(r, "procurement_type"),
            r.GetDecimal(r.GetOrdinal("min_amount")),
            GetNullableDecimal(r, "max_amount"),
            r.GetString(r.GetOrdinal("approval_route")),
            r.GetBoolean(r.GetOrdinal("requires_board")),
            r.GetBoolean(r.GetOrdinal("requires_bpp")),
            r.GetString(r.GetOrdinal("status")),
            GetNullableString(r, "notes"),
            r.GetDateTime(r.GetOrdinal("created_at")),
            r.GetDateTime(r.GetOrdinal("updated_at"))
        );
    }
}

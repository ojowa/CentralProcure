using eProcurement.Modules.PostAward.DTOs;
using eProcurement.Shared.Controllers;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.PostAward.Controllers;

[ApiController]
[Route("api/payments")]
public class PaymentsController : BaseModuleController
{
    private static readonly string[] AllowedPaymentStages =
    {
        "Awaiting Inspection",
        "Inspection In Progress",
        "Blocked by Inspection",
        "Awaiting Contract Completion",
        "Ready for Final Payment",
        "Archived"
    };

    public PaymentsController(IConfiguration config, ILogger<PaymentsController> logger)
        : base(config, logger)
    {
    }

    [HttpGet]
    public async Task<IActionResult> GetPayments(
        [FromQuery] string? status,
        [FromQuery] string? query,
        [FromQuery] bool? closeoutEligible,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(status) &&
            !AllowedPaymentStages.Any(item => item.Equals(status.Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            return BadRequest($"Status must be one of: {string.Join(", ", AllowedPaymentStages)}.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
WITH payment_rows AS (
    SELECT
        c.contract_id,
        c.contract_code,
        c.tender_title,
        c.vendor_name,
        c.contract_value,
        c.status AS contract_status,
        c.progress AS contract_progress,
        wi.current_stage_key,
        wsc.stage_title AS current_stage_title,
        wi.current_status AS workflow_status,
        i.inspection_code,
        i.status AS inspection_status,
        i.outcome AS inspection_outcome,
        i.completed_date AS inspection_completed_date,
        COALESCE(i.outcome = 'Accepted', FALSE) AS final_acceptance_completed,
        COALESCE(pc.final_payment_completed, FALSE) AS final_payment_recorded,
        (COALESCE(i.outcome = 'Accepted', FALSE) AND c.status = 'Completed' AND pc.closeout_id IS NULL) AS closeout_eligible,
        CASE
            WHEN pc.closeout_id IS NOT NULL THEN 'Archived'
            WHEN i.inspection_code IS NULL THEN 'Awaiting Inspection'
            WHEN i.status IN ('Scheduled', 'In Progress') OR COALESCE(i.outcome, 'Pending') = 'Pending' THEN 'Inspection In Progress'
            WHEN i.outcome = 'Rejected' THEN 'Blocked by Inspection'
            WHEN c.status <> 'Completed' THEN 'Awaiting Contract Completion'
            ELSE 'Ready for Final Payment'
        END AS payment_stage,
        pc.closeout_id,
        pc.closeout_reference,
        pc.status AS closeout_status,
        pc.archived_at
    FROM post_award.contracts c
    LEFT JOIN LATERAL (
        SELECT
            inspection_code,
            status,
            outcome,
            completed_date,
            created_at,
            updated_at
        FROM post_award.inspections i
        WHERE i.contract_code = c.contract_code
        ORDER BY COALESCE(i.completed_date, i.scheduled_date) DESC, i.updated_at DESC, i.created_at DESC
        LIMIT 1
    ) i ON TRUE
    LEFT JOIN procurement_workflow.workflow_instances wi
      ON wi.entity_type = 'contract'
     AND wi.entity_id = c.contract_id
    LEFT JOIN procurement_workflow.workflow_stage_catalog wsc
      ON wsc.stage_key = wi.current_stage_key
    LEFT JOIN procurement_workflow.procurement_closeouts pc
      ON pc.entity_type = 'contract'
     AND pc.entity_id = c.contract_id
    WHERE (
        @p_query IS NULL
        OR c.contract_code ILIKE '%' || @p_query || '%'
        OR c.tender_title ILIKE '%' || @p_query || '%'
        OR c.vendor_name ILIKE '%' || @p_query || '%'
        OR COALESCE(i.inspection_code, '') ILIKE '%' || @p_query || '%'
        OR COALESCE(pc.closeout_reference, '') ILIKE '%' || @p_query || '%'
    )
)
SELECT
    contract_id,
    contract_code,
    tender_title,
    vendor_name,
    contract_value,
    contract_status,
    contract_progress,
    current_stage_key,
    current_stage_title,
    workflow_status,
    inspection_code,
    inspection_status,
    inspection_outcome,
    inspection_completed_date,
    final_acceptance_completed,
    final_payment_recorded,
    closeout_eligible,
    payment_stage,
    closeout_id,
    closeout_reference,
    closeout_status,
    archived_at
FROM payment_rows
WHERE (@p_status IS NULL OR payment_stage = @p_status)
  AND (@p_closeout_eligible IS NULL OR closeout_eligible = @p_closeout_eligible)
ORDER BY
    closeout_eligible DESC,
    archived_at DESC NULLS LAST,
    contract_code ASC;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)NormalizeNullable(status) ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)NormalizeNullable(query) ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_closeout_eligible", NpgsqlDbType.Boolean, (object?)closeoutEligible ?? DBNull.Value);

            var results = new List<PaymentTrackingItem>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                results.Add(new PaymentTrackingItem(
                    reader.GetGuid(reader.GetOrdinal("contract_id")),
                    reader.GetString(reader.GetOrdinal("contract_code")),
                    reader.GetString(reader.GetOrdinal("tender_title")),
                    reader.GetString(reader.GetOrdinal("vendor_name")),
                    reader.GetDecimal(reader.GetOrdinal("contract_value")),
                    reader.GetString(reader.GetOrdinal("contract_status")),
                    reader.GetInt32(reader.GetOrdinal("contract_progress")),
                    GetNullableString(reader, "current_stage_key"),
                    GetNullableString(reader, "current_stage_title"),
                    GetNullableString(reader, "workflow_status"),
                    GetNullableString(reader, "inspection_code"),
                    GetNullableString(reader, "inspection_status"),
                    GetNullableString(reader, "inspection_outcome"),
                    GetNullableDateTime(reader, "inspection_completed_date"),
                    reader.GetBoolean(reader.GetOrdinal("final_acceptance_completed")),
                    reader.GetBoolean(reader.GetOrdinal("final_payment_recorded")),
                    reader.GetBoolean(reader.GetOrdinal("closeout_eligible")),
                    reader.GetString(reader.GetOrdinal("payment_stage")),
                    GetNullableGuid(reader, "closeout_id"),
                    GetNullableString(reader, "closeout_reference"),
                    GetNullableString(reader, "closeout_status"),
                    GetNullableDateTime(reader, "archived_at")));
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error retrieving payment tracking items.");
            return Problem("Internal server error retrieving payment tracking items.");
        }
    }

    private static string? NormalizeNullable(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

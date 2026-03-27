using System.Data;
using eProcurement.Modules.PostAward.DTOs;
using eProcurement.Shared.Controllers;
using eProcurement.Shared.Workflow;
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

    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

    public PaymentsController(
        IConfiguration config,
        ILogger<PaymentsController> logger,
        WorkflowRuntimeTracker workflowRuntimeTracker)
        : base(config, logger)
    {
        _workflowRuntimeTracker = workflowRuntimeTracker;
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

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            var hasPaymentSchema = await HasPaymentSchemaAsync(conn, ct);

            var paymentRecordedExpression = hasPaymentSchema
                ? "COALESCE(c.is_paid, FALSE)"
                : "FALSE";

            var closeoutEligibleExpression = hasPaymentSchema
                ? "(COALESCE(i.outcome = 'Accepted', FALSE) AND c.status = 'Completed' AND COALESCE(c.is_paid, FALSE) = TRUE AND pc.closeout_id IS NULL)"
                : "(COALESCE(i.outcome = 'Accepted', FALSE) AND c.status = 'Completed' AND pc.closeout_id IS NULL)";

            var paymentStageExpression = hasPaymentSchema
                ? @"CASE
            WHEN pc.closeout_id IS NOT NULL THEN 'Archived'
            WHEN i.inspection_code IS NULL THEN 'Awaiting Inspection'
            WHEN i.status IN ('Scheduled', 'In Progress') OR COALESCE(i.outcome, 'Pending') = 'Pending' THEN 'Inspection In Progress'
            WHEN i.outcome = 'Rejected' THEN 'Blocked by Inspection'
            WHEN c.status <> 'Completed' THEN 'Awaiting Contract Completion'
            WHEN NOT COALESCE(c.is_paid, FALSE) THEN 'Ready for Final Payment'
            ELSE 'Ready for Closeout'
        END"
                : @"CASE
            WHEN pc.closeout_id IS NOT NULL THEN 'Archived'
            WHEN i.inspection_code IS NULL THEN 'Awaiting Inspection'
            WHEN i.status IN ('Scheduled', 'In Progress') OR COALESCE(i.outcome, 'Pending') = 'Pending' THEN 'Inspection In Progress'
            WHEN i.outcome = 'Rejected' THEN 'Blocked by Inspection'
            WHEN c.status <> 'Completed' THEN 'Awaiting Contract Completion'
            ELSE 'Ready for Final Payment'
        END";

            var sql = $@"
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
        {paymentRecordedExpression} AS final_payment_recorded,
        {closeoutEligibleExpression} AS closeout_eligible,
        {paymentStageExpression} AS payment_stage,
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
                    GetNullableDateTime(reader, "archived_at"),
                    BuildWorkflowDisplay(reader)));
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error retrieving payment tracking items.");
            return Problem("Internal server error retrieving payment tracking items.");
        }
    }

    private static async Task<bool> HasPaymentSchemaAsync(NpgsqlConnection conn, CancellationToken ct)
    {
        const string sql = @"
SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'post_award'
      AND table_name = 'contracts'
      AND column_name = 'is_paid'
) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'post_award'
      AND table_name = 'payments'
);";

        await using var cmd = new NpgsqlCommand(sql, conn);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is bool flag && flag;
    }

    [HttpPost]
    public async Task<IActionResult> RecordPayment([FromBody] PaymentRecordRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ContractCode))
        {
            return BadRequest("ContractCode is required.");
        }

        if (request.Amount <= 0)
        {
            return BadRequest("Payment amount must be greater than zero.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            try
            {
                await using var cmd = new NpgsqlCommand("CALL post_award.record_payment_sp(@p_contract_code, @p_amount, @p_notes, @p_recorded_by, NULL, NULL)", conn, tx);
                cmd.Parameters.AddWithValue("p_contract_code", NpgsqlDbType.Varchar, request.ContractCode);
                cmd.Parameters.AddWithValue("p_amount", NpgsqlDbType.Numeric, request.Amount);
                cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)request.Notes ?? DBNull.Value);
                cmd.Parameters.AddWithValue("p_recorded_by", NpgsqlDbType.Varchar, User.Identity?.Name ?? "system");

                var pPaymentId = new NpgsqlParameter("p_payment_id", NpgsqlDbType.Uuid) { Direction = ParameterDirection.Output };
                var pPaymentRef = new NpgsqlParameter("p_payment_reference", NpgsqlDbType.Varchar, 80) { Direction = ParameterDirection.Output };
                cmd.Parameters.Add(pPaymentId);
                cmd.Parameters.Add(pPaymentRef);

                await cmd.ExecuteNonQueryAsync(ct);

                var paymentId = (Guid)pPaymentId.Value!;
                var paymentRef = (string)pPaymentRef.Value!;

                // Sync workflow runtime
                await SyncWorkflowAfterPaymentAsync(conn, tx, request.ContractCode, paymentRef, ct);

                await tx.CommitAsync(ct);

                return Ok(new PaymentRecordResponse(
                    paymentId,
                    paymentRef,
                    request.ContractCode,
                    request.Amount,
                    "Paid",
                    DateTime.UtcNow));
            }
            catch
            {
                await tx.RollbackAsync(ct);
                throw;
            }
        }
        catch (PostgresException ex)
        {
            Logger.LogWarning(ex, "Database error recording payment for contract {ContractCode}.", request.ContractCode);
            return BadRequest(new { message = ex.MessageText });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error recording payment for contract {ContractCode}.", request.ContractCode);
            return Problem("Internal server error recording payment.");
        }
    }

    private async Task SyncWorkflowAfterPaymentAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string contractCode, string paymentRef, CancellationToken ct)
    {
        const string sql = @"
SELECT contract_id, tender_title, contract_value 
FROM post_award.contracts 
WHERE contract_code = @p_contract_code;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_contract_code", contractCode);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct))
        {
            var contractId = reader.GetGuid(0);
            var title = reader.GetString(1);
            var value = reader.GetDecimal(2);
            await reader.CloseAsync();

            await _workflowRuntimeTracker.SyncAsync(
                conn,
                tx,
                new WorkflowRuntimeSyncRequest(
                    "contract",
                    contractId,
                    "inspection_and_payment",
                    "Completed",
                    title,
                    null,
                    null,
                    value,
                    null,
                    null,
                    $"Final payment {paymentRef} recorded.",
                    User.Identity?.Name,
                    "payment_recorded"),
                ct);
        }
    }

    private static string? NormalizeNullable(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static WorkflowRuntimeDisplay? BuildWorkflowDisplay(NpgsqlDataReader reader)
    {
        var currentStageKey = GetNullableString(reader, "current_stage_key");
        var currentStageTitle = GetNullableString(reader, "current_stage_title");
        if (string.IsNullOrWhiteSpace(currentStageKey) || string.IsNullOrWhiteSpace(currentStageTitle))
        {
            return null;
        }

        return WorkflowDisplayMapper.Build(currentStageKey, currentStageTitle);
    }
}

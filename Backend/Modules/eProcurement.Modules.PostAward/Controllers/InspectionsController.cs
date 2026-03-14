using System.Data;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.PostAward.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.PostAward.Controllers;

[ApiController]
[Route("api/inspections")]
public class InspectionsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<InspectionsController> _logger;
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private readonly WorkflowActionGrantService _workflowActionGrantService;

    private static readonly string[] AllowedStatuses = { "Scheduled", "In Progress", "Accepted", "Rejected" };
    private static readonly string[] AllowedOutcomes = { "Accepted", "Rejected", "Pending" };
    private const int MaxInspectorNameLength = 150;
    private const int MaxLocationLength = 255;

    public InspectionsController(
        IConfiguration config,
        ILogger<InspectionsController> logger,
        WorkflowPolicyGuard workflowPolicyGuard,
        WorkflowRuntimeTracker workflowRuntimeTracker,
        WorkflowActionGrantService workflowActionGrantService)
    {
        _config = config;
        _logger = logger;
        _workflowPolicyGuard = workflowPolicyGuard;
        _workflowRuntimeTracker = workflowRuntimeTracker;
        _workflowActionGrantService = workflowActionGrantService;
    }

    [HttpGet]
    public async Task<IActionResult> GetInspections([FromQuery] string? status, [FromQuery] string? query, CancellationToken ct)
    {
        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("post_award.get_inspections_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapInspection, ct);
            await tx.CommitAsync(ct);

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
        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("post_award.get_inspection_detail_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_inspection_code", NpgsqlDbType.Varchar, inspectionId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapInspection, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
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
        var validationError = ValidateUpdateRequest(request, out var normalizedStatus, out var normalizedOutcome);
        if (validationError is not null)
        {
            return BadRequest(new { message = validationError });
        }

        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            var existing = await GetInspectionStateAsync(conn, tx, inspectionId, ct);
            if (existing is null)
            {
                return NotFound(new { message = "Inspection not found." });
            }

            var hasAction = await _workflowActionGrantService.HasRequiredActionAsync(
                conn,
                tx,
                User,
                "inspection",
                existing.InspectionEntityId,
                "inspection.update",
                ct);

            if (!hasAction)
            {
                return Forbid();
            }

            WorkflowInstanceState? contractWorkflow = null;
            if (ShouldPromoteContractToInspectionStage(normalizedStatus ?? existing.Status))
            {
                contractWorkflow = await GetWorkflowInstanceAsync(conn, tx, "contract", existing.ContractId, ct);
                if (contractWorkflow is not null)
                {
                    var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(
                        conn,
                        tx,
                        "contract",
                        existing.ContractId,
                        "inspection_and_payment",
                        ct);

                    if (!transition.IsAllowed)
                    {
                        return BadRequest(new { message = transition.Message });
                    }
                }
            }

            var updated = await UpdateInspectionAsync(conn, tx, inspectionId, request, normalizedStatus, normalizedOutcome, ct);
            updated = updated with { ContractId = existing.ContractId };

            await _workflowRuntimeTracker.SyncAsync(
                conn,
                tx,
                new WorkflowRuntimeSyncRequest(
                    "inspection",
                    updated.InspectionEntityId,
                    "inspection_and_payment",
                    updated.Status,
                    updated.TenderTitle,
                    "contract",
                    updated.ContractId,
                    null,
                    null,
                    null,
                    "Inspection record updated.",
                    updated.InspectorName,
                    "inspection_update"),
                ct);

            if (contractWorkflow is not null)
            {
                await _workflowRuntimeTracker.SyncAsync(
                    conn,
                    tx,
                    new WorkflowRuntimeSyncRequest(
                        contractWorkflow.EntityType,
                        contractWorkflow.EntityId,
                        "inspection_and_payment",
                        contractWorkflow.CurrentStatus,
                        contractWorkflow.RecordTitle,
                        contractWorkflow.ParentEntityType,
                        contractWorkflow.ParentEntityId,
                        contractWorkflow.Amount,
                        contractWorkflow.ProcurementType,
                        contractWorkflow.ThresholdId,
                        $"Inspection {updated.InspectionCode} moved contract into inspection and payment.",
                        updated.InspectorName,
                        "inspection_update"),
                    ct);
            }

            await tx.CommitAsync(ct);
            return Ok(MapInspection(updated));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating inspection {InspectionId}.", inspectionId);
            return Problem("Internal server error updating inspection.");
        }
    }

    private static async Task<List<T>> ExecuteRefcursorAsync<T>(
        NpgsqlCommand cmd,
        Func<NpgsqlDataReader, T> map,
        CancellationToken ct)
    {
        await cmd.ExecuteNonQueryAsync(ct);
        var cursorName = (string)cmd.Parameters["p_result"].Value!;
        await using var fetch = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", cmd.Connection!, cmd.Transaction);
        await using var reader = await fetch.ExecuteReaderAsync(ct);

        var results = new List<T>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(map(reader));
        }

        return results;
    }

    private static InspectionItem MapInspection(NpgsqlDataReader reader)
    {
        return new InspectionItem(
            reader.GetString(reader.GetOrdinal("inspection_code")),
            reader.GetString(reader.GetOrdinal("contract_code")),
            reader.GetString(reader.GetOrdinal("tender_title")),
            reader.GetString(reader.GetOrdinal("vendor_name")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.GetDateTime(reader.GetOrdinal("scheduled_date")),
            reader.IsDBNull(reader.GetOrdinal("completed_date"))
                ? null
                : reader.GetDateTime(reader.GetOrdinal("completed_date")),
            reader.GetString(reader.GetOrdinal("inspector_name")),
            reader.IsDBNull(reader.GetOrdinal("outcome")) ? null : reader.GetString(reader.GetOrdinal("outcome")),
            reader.GetString(reader.GetOrdinal("location")),
            reader.IsDBNull(reader.GetOrdinal("notes")) ? null : reader.GetString(reader.GetOrdinal("notes"))
        );
    }

    private static InspectionItem MapInspection(InspectionState inspection)
    {
        return new InspectionItem(
            inspection.InspectionCode,
            inspection.ContractCode,
            inspection.TenderTitle,
            inspection.VendorName,
            inspection.Status,
            inspection.ScheduledDate,
            inspection.CompletedDate,
            inspection.InspectorName,
            inspection.Outcome,
            inspection.Location,
            inspection.Notes);
    }

    private static string? ValidateUpdateRequest(
        InspectionUpdateRequest? request,
        out string? normalizedStatus,
        out string? normalizedOutcome)
    {
        normalizedStatus = null;
        normalizedOutcome = null;

        if (request is null)
        {
            return "Request body is required.";
        }

        var hasAny =
            request.Status is not null ||
            request.Outcome is not null ||
            request.CompletedDate.HasValue ||
            request.Notes is not null ||
            request.InspectorName is not null ||
            request.Location is not null;

        if (!hasAny)
        {
            return "At least one field is required to update an inspection.";
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            normalizedStatus = AllowedStatuses.FirstOrDefault(item => item.Equals(request.Status.Trim(), StringComparison.OrdinalIgnoreCase));
            if (normalizedStatus is null)
            {
                return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Outcome))
        {
            normalizedOutcome = AllowedOutcomes.FirstOrDefault(item => item.Equals(request.Outcome.Trim(), StringComparison.OrdinalIgnoreCase));
            if (normalizedOutcome is null)
            {
                return $"Outcome must be one of: {string.Join(", ", AllowedOutcomes)}.";
            }
        }

        if (request.InspectorName is not null)
        {
            var trimmedInspector = request.InspectorName.Trim();
            if (trimmedInspector.Length == 0 || trimmedInspector.Length > MaxInspectorNameLength)
            {
                return $"InspectorName must be between 1 and {MaxInspectorNameLength} characters when provided.";
            }
        }

        if (request.Location is not null)
        {
            var trimmedLocation = request.Location.Trim();
            if (trimmedLocation.Length == 0 || trimmedLocation.Length > MaxLocationLength)
            {
                return $"Location must be between 1 and {MaxLocationLength} characters when provided.";
            }
        }

        if (string.Equals(normalizedStatus, "Accepted", StringComparison.OrdinalIgnoreCase) &&
            normalizedOutcome is not null &&
            !string.Equals(normalizedOutcome, "Accepted", StringComparison.OrdinalIgnoreCase))
        {
            return "Accepted inspections must have an Accepted outcome.";
        }

        if (string.Equals(normalizedStatus, "Rejected", StringComparison.OrdinalIgnoreCase) &&
            normalizedOutcome is not null &&
            !string.Equals(normalizedOutcome, "Rejected", StringComparison.OrdinalIgnoreCase))
        {
            return "Rejected inspections must have a Rejected outcome.";
        }

        return null;
    }

    private static bool ShouldPromoteContractToInspectionStage(string status)
        => status is "In Progress" or "Accepted" or "Rejected";

    private static async Task<InspectionState?> GetInspectionStateAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string inspectionCode,
        CancellationToken ct)
    {
        const string sql = @"
SELECT
    i.inspection_id,
    i.inspection_code,
    c.contract_id,
    i.contract_code,
    i.tender_title,
    i.vendor_name,
    i.status,
    i.scheduled_date,
    i.completed_date,
    i.inspector_name,
    i.outcome,
    i.location,
    i.notes
FROM post_award.inspections i
JOIN post_award.contracts c
  ON c.contract_code = i.contract_code
WHERE i.inspection_code = @p_inspection_code
FOR UPDATE;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_inspection_code", NpgsqlDbType.Varchar, inspectionCode);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new InspectionState(
            reader.GetGuid(reader.GetOrdinal("inspection_id")),
            reader.GetString(reader.GetOrdinal("inspection_code")),
            reader.GetGuid(reader.GetOrdinal("contract_id")),
            reader.GetString(reader.GetOrdinal("contract_code")),
            reader.GetString(reader.GetOrdinal("tender_title")),
            reader.GetString(reader.GetOrdinal("vendor_name")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.GetDateTime(reader.GetOrdinal("scheduled_date")),
            reader.IsDBNull(reader.GetOrdinal("completed_date")) ? null : reader.GetDateTime(reader.GetOrdinal("completed_date")),
            reader.GetString(reader.GetOrdinal("inspector_name")),
            reader.IsDBNull(reader.GetOrdinal("outcome")) ? null : reader.GetString(reader.GetOrdinal("outcome")),
            reader.GetString(reader.GetOrdinal("location")),
            reader.IsDBNull(reader.GetOrdinal("notes")) ? null : reader.GetString(reader.GetOrdinal("notes")));
    }

    private static async Task<InspectionState> UpdateInspectionAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string inspectionCode,
        InspectionUpdateRequest request,
        string? normalizedStatus,
        string? normalizedOutcome,
        CancellationToken ct)
    {
        const string sql = @"
UPDATE post_award.inspections
SET
    status = COALESCE(@p_status, status),
    outcome = COALESCE(
        @p_outcome,
        CASE
            WHEN COALESCE(@p_status, status) = 'Accepted' THEN 'Accepted'
            WHEN COALESCE(@p_status, status) = 'Rejected' THEN 'Rejected'
            ELSE outcome
        END
    ),
    completed_date = COALESCE(
        @p_completed_date,
        completed_date,
        CASE
            WHEN COALESCE(@p_status, status) IN ('Accepted', 'Rejected') THEN NOW()
            ELSE NULL
        END
    ),
    notes = COALESCE(@p_notes, notes),
    inspector_name = COALESCE(@p_inspector_name, inspector_name),
    location = COALESCE(@p_location, location),
    updated_at = NOW()
WHERE inspection_code = @p_inspection_code
RETURNING
    inspection_id,
    inspection_code,
    contract_code,
    tender_title,
    vendor_name,
    status,
    scheduled_date,
    completed_date,
    inspector_name,
    outcome,
    location,
    notes;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_inspection_code", NpgsqlDbType.Varchar, inspectionCode);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_outcome", NpgsqlDbType.Varchar, (object?)normalizedOutcome ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_completed_date", NpgsqlDbType.Timestamp, (object?)request.CompletedDate ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)NormalizeNullable(request.Notes) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_inspector_name", NpgsqlDbType.Varchar, (object?)NormalizeNullable(request.InspectorName) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_location", NpgsqlDbType.Varchar, (object?)NormalizeNullable(request.Location) ?? DBNull.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);

        return new InspectionState(
            reader.GetGuid(reader.GetOrdinal("inspection_id")),
            reader.GetString(reader.GetOrdinal("inspection_code")),
            Guid.Empty,
            reader.GetString(reader.GetOrdinal("contract_code")),
            reader.GetString(reader.GetOrdinal("tender_title")),
            reader.GetString(reader.GetOrdinal("vendor_name")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.GetDateTime(reader.GetOrdinal("scheduled_date")),
            reader.IsDBNull(reader.GetOrdinal("completed_date")) ? null : reader.GetDateTime(reader.GetOrdinal("completed_date")),
            reader.GetString(reader.GetOrdinal("inspector_name")),
            reader.IsDBNull(reader.GetOrdinal("outcome")) ? null : reader.GetString(reader.GetOrdinal("outcome")),
            reader.GetString(reader.GetOrdinal("location")),
            reader.IsDBNull(reader.GetOrdinal("notes")) ? null : reader.GetString(reader.GetOrdinal("notes")));
    }

    private static async Task<WorkflowInstanceState?> GetWorkflowInstanceAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        const string sql = @"
SELECT
    entity_type,
    entity_id,
    current_stage_key,
    current_status,
    record_title,
    parent_entity_type,
    parent_entity_id,
    amount,
    procurement_type,
    threshold_id
FROM procurement_workflow.workflow_instances
WHERE entity_type = @p_entity_type
  AND entity_id = @p_entity_id
FOR UPDATE;";

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_entity_type", NpgsqlDbType.Varchar, entityType);
        cmd.Parameters.AddWithValue("p_entity_id", NpgsqlDbType.Uuid, entityId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new WorkflowInstanceState(
            reader.GetString(reader.GetOrdinal("entity_type")),
            reader.GetGuid(reader.GetOrdinal("entity_id")),
            reader.GetString(reader.GetOrdinal("current_stage_key")),
            reader.IsDBNull(reader.GetOrdinal("current_status")) ? null : reader.GetString(reader.GetOrdinal("current_status")),
            reader.IsDBNull(reader.GetOrdinal("record_title")) ? null : reader.GetString(reader.GetOrdinal("record_title")),
            reader.IsDBNull(reader.GetOrdinal("parent_entity_type")) ? null : reader.GetString(reader.GetOrdinal("parent_entity_type")),
            reader.IsDBNull(reader.GetOrdinal("parent_entity_id")) ? null : reader.GetGuid(reader.GetOrdinal("parent_entity_id")),
            reader.IsDBNull(reader.GetOrdinal("amount")) ? null : reader.GetFieldValue<decimal>(reader.GetOrdinal("amount")),
            reader.IsDBNull(reader.GetOrdinal("procurement_type")) ? null : reader.GetString(reader.GetOrdinal("procurement_type")),
            reader.IsDBNull(reader.GetOrdinal("threshold_id")) ? null : reader.GetGuid(reader.GetOrdinal("threshold_id")));
    }

    private static string? NormalizeNullable(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed record InspectionState(
        Guid InspectionEntityId,
        string InspectionCode,
        Guid ContractId,
        string ContractCode,
        string TenderTitle,
        string VendorName,
        string Status,
        DateTime ScheduledDate,
        DateTime? CompletedDate,
        string InspectorName,
        string? Outcome,
        string Location,
        string? Notes);

    private sealed record WorkflowInstanceState(
        string EntityType,
        Guid EntityId,
        string CurrentStageKey,
        string? CurrentStatus,
        string? RecordTitle,
        string? ParentEntityType,
        Guid? ParentEntityId,
        decimal? Amount,
        string? ProcurementType,
        Guid? ThresholdId);
}

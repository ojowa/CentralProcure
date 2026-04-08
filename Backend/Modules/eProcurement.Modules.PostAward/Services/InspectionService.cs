using System.Data;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.PostAward.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.PostAward.Services;

public class InspectionService : IInspectionService
{
    private readonly IConfiguration _config;
    private readonly ILogger<InspectionService> _logger;
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private readonly WorkflowActionGrantService _workflowActionGrantService;

    private static readonly string[] AllowedStatuses = { "Scheduled", "In Progress", "Accepted", "Rejected" };
    private static readonly string[] AllowedOutcomes = { "Accepted", "Rejected", "Pending" };
    private const int MaxInspectorNameLength = 150;
    private const int MaxLocationLength = 255;

    public InspectionService(
        IConfiguration config,
        ILogger<InspectionService> logger,
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

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    public async Task<List<InspectionItem>> GetInspectionsAsync(string? status, string? query, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("post_award.get_inspections_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
        var results = await ExecuteRefcursorAsync(cmd, MapInspection, ct);
        await tx.CommitAsync(ct);
        return results;
    }

    public async Task<InspectionItem?> GetInspectionAsync(string inspectionId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("post_award.get_inspection_detail_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_inspection_code", NpgsqlDbType.Varchar, inspectionId);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
        var results = await ExecuteRefcursorAsync(cmd, MapInspection, ct);
        await tx.CommitAsync(ct);
        return results.FirstOrDefault();
    }

    public async Task<InspectionItem> UpdateInspectionAsync(string inspectionId, InspectionUpdateRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var validationError = ValidateUpdateRequest(request, out var normalizedStatus, out var normalizedOutcome);
        if (validationError is not null) throw new ArgumentException(validationError);

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var existing = await GetInspectionStateAsync(conn, tx, inspectionId, ct) ?? throw new KeyNotFoundException("Inspection not found.");
        if (!await _workflowActionGrantService.HasRequiredActionAsync(conn, tx, user, "inspection", existing.InspectionEntityId, "inspection.update", ct))
            throw new UnauthorizedAccessException("User does not have permission to update this inspection.");

        WorkflowInstanceState? contractWorkflow = null;
        if (ShouldPromoteContractToInspectionStage(normalizedStatus ?? existing.Status))
        {
            contractWorkflow = await GetWorkflowInstanceAsync(conn, tx, "contract", existing.ContractId, ct);
            if (contractWorkflow is not null)
            {
                var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(conn, tx, "contract", existing.ContractId, "inspection_and_payment", ct);
                if (!transition.IsAllowed) throw new InvalidOperationException(transition.Message);
            }
        }

        var updatedState = await UpdateInspectionInternalAsync(conn, tx, inspectionId, request, normalizedStatus, normalizedOutcome, ct);
        var updated = MapInspectionStateToItem(updatedState with { ContractId = existing.ContractId });

        await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest("inspection", updatedState.InspectionEntityId, "inspection_and_payment", updated.Status, updated.TenderTitle, "contract", existing.ContractId, null, null, null, "Inspection record updated.", updated.InspectorName, "inspection_update"), ct);

        if (contractWorkflow is not null)
        {
            await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest(contractWorkflow.EntityType, contractWorkflow.EntityId, "inspection_and_payment", contractWorkflow.CurrentStatus, contractWorkflow.RecordTitle, contractWorkflow.ParentEntityType, contractWorkflow.ParentEntityId, contractWorkflow.Amount, contractWorkflow.ProcurementType, contractWorkflow.ThresholdId, $"Inspection {updated.InspectionId} moved contract into inspection and payment.", updated.InspectorName, "inspection_update"), ct);
        }

        await tx.CommitAsync(ct);
        return updated;
    }

    private static async Task<List<T>> ExecuteRefcursorAsync<T>(NpgsqlCommand cmd, Func<NpgsqlDataReader, T> map, CancellationToken ct)
    {
        await cmd.ExecuteNonQueryAsync(ct);
        var cursorName = (string)cmd.Parameters["p_result"].Value!;
        await using var fetch = new NpgsqlCommand($"FETCH ALL IN \"{cursorName}\"", cmd.Connection!, cmd.Transaction);
        await using var reader = await fetch.ExecuteReaderAsync(ct);
        var results = new List<T>();
        while (await reader.ReadAsync(ct)) results.Add(map(reader));
        return results;
    }

    private static InspectionItem MapInspection(NpgsqlDataReader reader) => new(
        reader.GetString(reader.GetOrdinal("inspection_code")), reader.GetString(reader.GetOrdinal("contract_code")), reader.GetString(reader.GetOrdinal("tender_title")), reader.GetString(reader.GetOrdinal("vendor_name")),
        reader.GetString(reader.GetOrdinal("status")), reader.GetDateTime(reader.GetOrdinal("scheduled_date")), reader.IsDBNull(reader.GetOrdinal("completed_date")) ? null : reader.GetDateTime(reader.GetOrdinal("completed_date")),
        reader.GetString(reader.GetOrdinal("inspector_name")), reader.IsDBNull(reader.GetOrdinal("outcome")) ? null : reader.GetString(reader.GetOrdinal("outcome")), reader.GetString(reader.GetOrdinal("location")), reader.IsDBNull(reader.GetOrdinal("notes")) ? null : reader.GetString(reader.GetOrdinal("notes")));

    private static InspectionItem MapInspectionStateToItem(InspectionState i) => new(i.InspectionCode, i.ContractCode, i.TenderTitle, i.VendorName, i.Status, i.ScheduledDate, i.CompletedDate, i.InspectorName, i.Outcome, i.Location, i.Notes);

    private static string? ValidateUpdateRequest(InspectionUpdateRequest? request, out string? normalizedStatus, out string? normalizedOutcome)
    {
        normalizedStatus = null; normalizedOutcome = null;
        if (request is null) return "Request body is required.";
        var hasAny = request.Status is not null || request.Outcome is not null || request.CompletedDate.HasValue || request.Notes is not null || request.InspectorName is not null || request.Location is not null;
        if (!hasAny) return "At least one field is required.";
        if (!string.IsNullOrWhiteSpace(request.Status)) { normalizedStatus = AllowedStatuses.FirstOrDefault(s => s.Equals(request.Status.Trim(), StringComparison.OrdinalIgnoreCase)); if (normalizedStatus is null) return "Invalid status."; }
        if (!string.IsNullOrWhiteSpace(request.Outcome)) { normalizedOutcome = AllowedOutcomes.FirstOrDefault(o => o.Equals(request.Outcome.Trim(), StringComparison.OrdinalIgnoreCase)); if (normalizedOutcome is null) return "Invalid outcome."; }
        if (request.InspectorName?.Length > MaxInspectorNameLength) return "Inspector name too long.";
        if (request.Location?.Length > MaxLocationLength) return "Location too long.";
        if (string.Equals(normalizedStatus, "Accepted", StringComparison.OrdinalIgnoreCase) && normalizedOutcome is not null && !string.Equals(normalizedOutcome, "Accepted", StringComparison.OrdinalIgnoreCase)) return "Accepted inspections must have Accepted outcome.";
        if (string.Equals(normalizedStatus, "Rejected", StringComparison.OrdinalIgnoreCase) && normalizedOutcome is not null && !string.Equals(normalizedOutcome, "Rejected", StringComparison.OrdinalIgnoreCase)) return "Rejected inspections must have Rejected outcome.";
        return null;
    }

    private static bool ShouldPromoteContractToInspectionStage(string status) => status is "In Progress" or "Accepted" or "Rejected";

    private static async Task<InspectionState?> GetInspectionStateAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string code, CancellationToken ct)
    {
        const string sql = "SELECT i.inspection_id, i.inspection_code, c.contract_id, i.contract_code, i.tender_title, i.vendor_name, i.status, i.scheduled_date, i.completed_date, i.inspector_name, i.outcome, i.location, i.notes FROM post_award.inspections i JOIN post_award.contracts c ON c.contract_code = i.contract_code WHERE i.inspection_code = @p_code FOR UPDATE;";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_code", code);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;
        return new InspectionState(r.GetGuid(0), r.GetString(1), r.GetGuid(2), r.GetString(3), r.GetString(4), r.GetString(5), r.GetString(6), r.GetDateTime(7), r.IsDBNull(8) ? null : r.GetDateTime(8), r.GetString(9), r.IsDBNull(10) ? null : r.GetString(10), r.GetString(11), r.IsDBNull(12) ? null : r.GetString(12));
    }

    private static async Task<InspectionState> UpdateInspectionInternalAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string code, InspectionUpdateRequest req, string? nStatus, string? nOutcome, CancellationToken ct)
    {
        const string sql = @"UPDATE post_award.inspections SET status = COALESCE(@p_status, status), outcome = COALESCE(@p_outcome, CASE WHEN COALESCE(@p_status, status) = 'Accepted' THEN 'Accepted' WHEN COALESCE(@p_status, status) = 'Rejected' THEN 'Rejected' ELSE outcome END), completed_date = COALESCE(@p_completed_date, completed_date, CASE WHEN COALESCE(@p_status, status) IN ('Accepted', 'Rejected') THEN NOW() ELSE NULL END), notes = COALESCE(@p_notes, notes), inspector_name = COALESCE(@p_inspector_name, inspector_name), location = COALESCE(@p_location, location), updated_at = NOW() WHERE inspection_code = @p_code RETURNING inspection_id, inspection_code, contract_code, tender_title, vendor_name, status, scheduled_date, completed_date, inspector_name, outcome, location, notes;";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_code", code);
        cmd.Parameters.AddWithValue("p_status", (object?)nStatus ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_outcome", (object?)nOutcome ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_completed_date", (object?)req.CompletedDate ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_notes", (object?)req.Notes?.Trim() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_inspector_name", (object?)req.InspectorName?.Trim() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_location", (object?)req.Location?.Trim() ?? DBNull.Value);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        await r.ReadAsync(ct);
        return new InspectionState(r.GetGuid(0), r.GetString(1), Guid.Empty, r.GetString(2), r.GetString(3), r.GetString(4), r.GetString(5), r.GetDateTime(6), r.IsDBNull(7) ? null : r.GetDateTime(7), r.GetString(8), r.IsDBNull(9) ? null : r.GetString(9), r.GetString(10), r.IsDBNull(11) ? null : r.GetString(11));
    }

    private static async Task<WorkflowInstanceState?> GetWorkflowInstanceAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string type, Guid id, CancellationToken ct)
    {
        const string sql = "SELECT entity_type, entity_id, current_stage_key, current_status, record_title, parent_entity_type, parent_entity_id, amount, procurement_type, threshold_id FROM procurement_workflow.workflow_instances WHERE entity_type = @p_type AND entity_id = @p_id FOR UPDATE;";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_type", type);
        cmd.Parameters.AddWithValue("p_id", id);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;
        return new WorkflowInstanceState(r.GetString(0), r.GetGuid(1), r.GetString(2), r.IsDBNull(3) ? null : r.GetString(3), r.IsDBNull(4) ? null : r.GetString(4), r.IsDBNull(5) ? null : r.GetString(5), r.IsDBNull(6) ? null : r.GetGuid(6), r.IsDBNull(7) ? null : r.GetDecimal(7), r.IsDBNull(8) ? null : r.GetString(8), r.IsDBNull(9) ? null : r.GetGuid(9));
    }

    private sealed record InspectionState(Guid InspectionEntityId, string InspectionCode, Guid ContractId, string ContractCode, string TenderTitle, string VendorName, string Status, DateTime ScheduledDate, DateTime? CompletedDate, string InspectorName, string? Outcome, string Location, string? Notes);
    private sealed record WorkflowInstanceState(string EntityType, Guid EntityId, string CurrentStageKey, string? CurrentStatus, string? RecordTitle, string? ParentEntityType, Guid? ParentEntityId, decimal? Amount, string? ProcurementType, Guid? ThresholdId);
}

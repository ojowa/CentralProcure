using System.Data;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Services;

public class BppNoObjectionService : IBppNoObjectionService
{
    private readonly IConfiguration _config;
    private readonly ILogger<BppNoObjectionService> _logger;
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private readonly WorkflowActionGrantService _workflowActionGrantService;

    private static readonly string[] AllowedStatuses = { "Draft", "Submitted", "In Review", "Approved", "Rejected", "Cancelled" };

    public BppNoObjectionService(
        IConfiguration config,
        ILogger<BppNoObjectionService> logger,
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

    public async Task<List<BppNoObjectionDetail>> GetNoObjectionsAsync(Guid? requisitionId, Guid? tenderId, string? status, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(status) && !AllowedStatuses.Any(s => s.Equals(status.Trim(), StringComparison.OrdinalIgnoreCase)))
            throw new ArgumentException($"Status must be one of: {string.Join(", ", AllowedStatuses)}.");

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        const string sql = @"
            SELECT no_objection_id, requisition_id, tender_id, amount, procurement_type, status, requested_by, requested_at, decision_by, decision_at, decision_notes, reference_code, created_at, updated_at
            FROM procurement_workflow.bpp_no_objections
            WHERE (@p_requisition_id IS NULL OR requisition_id = @p_requisition_id)
              AND (@p_tender_id IS NULL OR tender_id = @p_tender_id)
              AND (@p_status IS NULL OR status = @p_status)
            ORDER BY requested_at DESC;";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_requisition_id", (object?)requisitionId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_tender_id", (object?)tenderId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_status", (object?)status ?? DBNull.Value);

        var results = new List<BppNoObjectionDetail>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) results.Add(MapNoObjection(reader));
        return results;
    }

    public async Task<BppNoObjectionDetail?> GetNoObjectionAsync(Guid noObjectionId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        const string sql = "SELECT no_objection_id, requisition_id, tender_id, amount, procurement_type, status, requested_by, requested_at, decision_by, decision_at, decision_notes, reference_code, created_at, updated_at FROM procurement_workflow.bpp_no_objections WHERE no_objection_id = @p_no_objection_id;";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("p_no_objection_id", noObjectionId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? MapNoObjection(reader) : null;
    }

    public async Task<BppNoObjectionDetail> CreateNoObjectionAsync(BppNoObjectionCreateRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var validationError = ValidateCreateRequest(request, out var normalizedStatus);
        if (validationError is not null) throw new ArgumentException(validationError);

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var parentEntityType = request.TenderId.HasValue ? "tender" : "requisition";
        var parentEntityId = request.TenderId ?? request.RequisitionId!.Value;
        if (!await _workflowActionGrantService.HasRequiredActionAsync(conn, tx, user, parentEntityType, parentEntityId, "bpp.create", ct))
            throw new UnauthorizedAccessException();

        const string sql = @"
            INSERT INTO procurement_workflow.bpp_no_objections (requisition_id, tender_id, amount, procurement_type, status, requested_by, requested_at, reference_code)
            VALUES (@p_requisition_id, @p_tender_id, @p_amount, @p_procurement_type, COALESCE(@p_status, 'Draft'), @p_requested_by, COALESCE(@p_requested_at, NOW()), @p_reference_code)
            RETURNING no_objection_id, requisition_id, tender_id, amount, procurement_type, status, requested_by, requested_at, decision_by, decision_at, decision_notes, reference_code, created_at, updated_at;";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_requisition_id", (object?)request.RequisitionId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_tender_id", (object?)request.TenderId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_amount", request.Amount);
        cmd.Parameters.AddWithValue("p_procurement_type", (object?)request.ProcurementType ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_status", (object?)normalizedStatus ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_requested_by", (object?)request.RequestedBy ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_requested_at", (object?)request.RequestedAt ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_reference_code", (object?)request.ReferenceCode ?? DBNull.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        var result = MapNoObjection(reader);
        await reader.CloseAsync();
        await SyncWorkflowRuntimeAsync(conn, tx, result, "BPP no objection created.", ct);
        await tx.CommitAsync(ct);
        return result;
    }

    public async Task<BppNoObjectionDetail> UpdateNoObjectionAsync(Guid noObjectionId, BppNoObjectionUpdateRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var validationError = ValidateUpdateRequest(request, out var normalizedStatus);
        if (validationError is not null) throw new ArgumentException(validationError);

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        if (await GetNoObjectionRuntimeParentAsync(conn, tx, noObjectionId, ct) is null) throw new KeyNotFoundException("No objection record not found.");

        var requiredAction = request.DecisionBy is not null || normalizedStatus is "Approved" or "Rejected" ? "bpp.decide" : "bpp.review";
        if (!await _workflowActionGrantService.HasRequiredActionAsync(conn, tx, user, "bpp_no_objection", noObjectionId, requiredAction, ct))
            throw new UnauthorizedAccessException();

        const string sql = @"
            UPDATE procurement_workflow.bpp_no_objections
            SET status = COALESCE(@p_status, status), decision_by = COALESCE(@p_decision_by, decision_by), decision_at = COALESCE(@p_decision_at, decision_at), decision_notes = COALESCE(@p_decision_notes, decision_notes), reference_code = COALESCE(@p_reference_code, reference_code), updated_at = NOW()
            WHERE no_objection_id = @p_no_objection_id
            RETURNING no_objection_id, requisition_id, tender_id, amount, procurement_type, status, requested_by, requested_at, decision_by, decision_at, decision_notes, reference_code, created_at, updated_at;";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_no_objection_id", noObjectionId);
        cmd.Parameters.AddWithValue("p_status", (object?)normalizedStatus ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_decision_by", (object?)request.DecisionBy ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_decision_at", (object?)request.DecisionAt ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_decision_notes", (object?)request.DecisionNotes ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_reference_code", (object?)request.ReferenceCode ?? DBNull.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw new KeyNotFoundException("No objection record not found.");
        var result = MapNoObjection(reader);
        await reader.CloseAsync();
        await SyncWorkflowRuntimeAsync(conn, tx, result, "BPP no objection updated.", ct);
        await tx.CommitAsync(ct);
        return result;
    }

    private static BppNoObjectionDetail MapNoObjection(NpgsqlDataReader r) => new(r.GetGuid(0), r.IsDBNull(1) ? null : r.GetGuid(1), r.IsDBNull(2) ? null : r.GetGuid(2), r.GetFieldValue<decimal>(3), r.IsDBNull(4) ? null : r.GetString(4), r.GetString(5), r.IsDBNull(6) ? null : r.GetString(6), r.GetDateTime(7), r.IsDBNull(8) ? null : r.GetString(8), r.IsDBNull(9) ? null : r.GetDateTime(9), r.IsDBNull(10) ? null : r.GetString(10), r.IsDBNull(11) ? null : r.GetString(11), r.GetDateTime(12), r.GetDateTime(13));

    private async Task SyncWorkflowRuntimeAsync(NpgsqlConnection conn, NpgsqlTransaction tx, BppNoObjectionDetail r, string reason, CancellationToken ct)
    {
        var pType = r.TenderId.HasValue ? "tender" : r.RequisitionId.HasValue ? "requisition" : null;
        var pId = r.TenderId ?? r.RequisitionId;
        var threshold = await _workflowPolicyGuard.ResolveThresholdAsync(conn, tx, r.ProcurementType, r.Amount, ct);
        await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest("bpp_no_objection", r.NoObjectionId, "bpp_no_objection", r.Status, r.ReferenceCode ?? "BPP No Objection", pType, pId, r.Amount, r.ProcurementType, threshold?.ThresholdId, reason, r.DecisionBy ?? r.RequestedBy), ct);
    }

    private string? ValidateCreateRequest(BppNoObjectionCreateRequest r, out string? nStatus)
    {
        nStatus = null; if (!r.RequisitionId.HasValue && !r.TenderId.HasValue) return "Either RequisitionId or TenderId is required.";
        if (r.Amount <= 0) return "Amount must be greater than 0.";
        if (!string.IsNullOrWhiteSpace(r.Status)) { nStatus = AllowedStatuses.FirstOrDefault(s => s.Equals(r.Status.Trim(), StringComparison.OrdinalIgnoreCase)); if (nStatus is null) return $"Status must be one of: {string.Join(", ", AllowedStatuses)}."; }
        return null;
    }

    private string? ValidateUpdateRequest(BppNoObjectionUpdateRequest r, out string? nStatus)
    {
        nStatus = null; if (r.Status is null && r.DecisionBy is null && !r.DecisionAt.HasValue && r.DecisionNotes is null && r.ReferenceCode is null) return "At least one field is required.";
        if (!string.IsNullOrWhiteSpace(r.Status)) { nStatus = AllowedStatuses.FirstOrDefault(s => s.Equals(r.Status.Trim(), StringComparison.OrdinalIgnoreCase)); if (nStatus is null) return $"Status must be one of: {string.Join(", ", AllowedStatuses)}."; }
        return null;
    }

    private static async Task<(string ParentEntityType, Guid ParentEntityId)?> GetNoObjectionRuntimeParentAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid id, CancellationToken ct)
    {
        const string sql = "SELECT CASE WHEN tender_id IS NOT NULL THEN 'tender' WHEN requisition_id IS NOT NULL THEN 'requisition' ELSE NULL END, COALESCE(tender_id, requisition_id) FROM procurement_workflow.bpp_no_objections WHERE no_objection_id = @p_id;";
        await using var cmd = new NpgsqlCommand(sql, conn, tx); cmd.Parameters.AddWithValue("p_id", id);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct) && !reader.IsDBNull(0) && !reader.IsDBNull(1)) return (reader.GetString(0), reader.GetGuid(1));
        return null;
    }
}

using System.Data;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.PostAward.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.PostAward.Services;

public class ContractService : IContractService
{
    private readonly IConfiguration _config;
    private readonly ILogger<ContractService> _logger;
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private readonly WorkflowActionGrantService _workflowActionGrantService;
    private static readonly string[] AllowedContractStatuses = { "Active", "On Hold", "Completed", "Terminated" };
    private const int MaxMilestoneTitleLength = 180;
    private const int MaxContractManagerLength = 150;
    private const int MaxRecordedByLength = 255;

    public ContractService(
        IConfiguration config,
        ILogger<ContractService> logger,
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

    public async Task<List<ContractManagementItem>> GetContractsAsync(string? status, string? query, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("post_award.get_contracts_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
        var results = await ExecuteRefcursorAsync(cmd, MapContract, ct);
        await tx.CommitAsync(ct);
        return results;
    }

    public async Task<ContractManagementItem?> GetContractAsync(string contractId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("post_award.get_contract_detail_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_contract_code", NpgsqlDbType.Varchar, contractId);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
        var results = await ExecuteRefcursorAsync(cmd, MapContract, ct);
        await tx.CommitAsync(ct);
        return results.FirstOrDefault();
    }

    public async Task<List<ContractMilestoneItem>> GetContractMilestonesAsync(string contractId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("post_award.get_contract_milestones_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_contract_code", NpgsqlDbType.Varchar, contractId);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
        var results = await ExecuteRefcursorAsync(cmd, MapContractMilestone, ct);
        await tx.CommitAsync(ct);
        return results;
    }

    public async Task<ContractManagementItem> LogContractMilestoneAsync(string contractId, ContractMilestoneCreateRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var validationError = ValidateMilestoneRequest(request, out var normalizedStatus, out var normalizedManager, out var normalizedRecordedBy);
        if (validationError is not null) throw new ArgumentException(validationError);

        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var targetStageKey = ResolveContractWorkflowStage(normalizedStatus);
        var contractEntityId = await GetContractEntityIdAsync(conn, tx, contractId, ct);
        if (!contractEntityId.HasValue) throw new KeyNotFoundException("Contract not found.");

        if (!await _workflowActionGrantService.HasRequiredActionAsync(conn, tx, user, "contract", contractEntityId.Value, "contract_management.manage", ct))
            throw new UnauthorizedAccessException("User does not have permission to manage this contract.");

        var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(conn, tx, "contract", contractEntityId.Value, targetStageKey, ct);
        if (!transition.IsAllowed) throw new InvalidOperationException(transition.Message);

        await using var cmd = new NpgsqlCommand("post_award.log_contract_milestone_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_contract_code", NpgsqlDbType.Varchar, contractId);
        cmd.Parameters.AddWithValue("p_milestone_title", NpgsqlDbType.Varchar, request.MilestoneTitle.Trim());
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, normalizedStatus);
        cmd.Parameters.AddWithValue("p_progress", NpgsqlDbType.Integer, request.Progress);
        cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, request.Notes.Trim());
        cmd.Parameters.AddWithValue("p_contract_manager", NpgsqlDbType.Varchar, (object?)normalizedManager ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_recorded_by", NpgsqlDbType.Varchar, (object?)normalizedRecordedBy ?? DBNull.Value);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });

        var results = await ExecuteRefcursorAsync(cmd, MapContract, ct);
        var result = results.FirstOrDefault() ?? throw new KeyNotFoundException("Contract not found after logging milestone.");
        await SyncContractWorkflowRuntimeAsync(conn, tx, contractEntityId.Value, result, "Contract milestone recorded.", ct);
        await tx.CommitAsync(ct);
        return result;
    }

    public async Task<List<ContractAwardItem>> GetAwardsAsync(string? status, string? query, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("post_award.get_contract_awards_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
        var results = await ExecuteRefcursorAsync(cmd, MapContractAward, ct);
        await tx.CommitAsync(ct);
        return results;
    }

    public async Task<ContractAwardItem?> GetAwardAsync(string awardId, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("post_award.get_contract_award_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_award_code", NpgsqlDbType.Varchar, awardId);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
        var results = await ExecuteRefcursorAsync(cmd, MapContractAward, ct);
        await tx.CommitAsync(ct);
        return results.FirstOrDefault();
    }

    public async Task<ContractAwardItem> PublishAwardAsync(string awardId, ClaimsPrincipal user, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var awardEntityId = await GetContractAwardEntityIdAsync(conn, tx, awardId, ct);
        if (!awardEntityId.HasValue) throw new KeyNotFoundException("Award not found.");

        if (!await _workflowActionGrantService.HasRequiredActionAsync(conn, tx, user, "contract_award", awardEntityId.Value, "contract_award.publish", ct))
            throw new UnauthorizedAccessException("User does not have permission to publish this award.");

        var transition = await _workflowPolicyGuard.EvaluateTransitionAsync(conn, tx, "contract_award", awardEntityId.Value, "award_and_publication", ct);
        if (!transition.IsAllowed) throw new InvalidOperationException(transition.Message);

        await using var cmd = new NpgsqlCommand("post_award.publish_contract_award_sp", conn, tx) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("p_award_code", NpgsqlDbType.Varchar, awardId);
        cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor) { Direction = ParameterDirection.Output });
        var results = await ExecuteRefcursorAsync(cmd, MapContractAward, ct);
        var result = results.FirstOrDefault() ?? throw new KeyNotFoundException("Award not found after publishing.");
        await SyncContractAwardWorkflowRuntimeAsync(conn, tx, awardEntityId.Value, result, "Contract award published.", ct);
        await tx.CommitAsync(ct);
        return result;
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

    private static ContractAwardItem MapContractAward(NpgsqlDataReader reader) => new(
        reader.GetGuid(reader.GetOrdinal("award_id")), reader.GetString(reader.GetOrdinal("award_code")), reader.GetString(reader.GetOrdinal("tender_title")), reader.GetString(reader.GetOrdinal("vendor_name")),
        reader.GetFieldValue<decimal>(reader.GetOrdinal("award_value")), reader.GetString(reader.GetOrdinal("status")), reader.GetDateTime(reader.GetOrdinal("award_date")), reader.GetDateTime(reader.GetOrdinal("contract_start")),
        reader.GetDateTime(reader.GetOrdinal("contract_end")), reader.GetString(reader.GetOrdinal("funding_source")), reader.IsDBNull(reader.GetOrdinal("notes")) ? string.Empty : reader.GetString(reader.GetOrdinal("notes")));

    private static ContractManagementItem MapContract(NpgsqlDataReader reader) => new(
        reader.GetString(reader.GetOrdinal("contract_code")), reader.GetString(reader.GetOrdinal("tender_title")), reader.GetString(reader.GetOrdinal("vendor_name")), reader.GetFieldValue<decimal>(reader.GetOrdinal("contract_value")),
        reader.GetString(reader.GetOrdinal("status")), reader.GetDateTime(reader.GetOrdinal("start_date")), reader.GetDateTime(reader.GetOrdinal("end_date")), reader.GetInt32(reader.GetOrdinal("progress")),
        reader.GetString(reader.GetOrdinal("contract_manager")), reader.IsDBNull(reader.GetOrdinal("notes")) ? string.Empty : reader.GetString(reader.GetOrdinal("notes")));

    private static ContractMilestoneItem MapContractMilestone(NpgsqlDataReader reader) => new(
        reader.GetGuid(reader.GetOrdinal("milestone_id")), reader.GetString(reader.GetOrdinal("contract_code")), reader.GetString(reader.GetOrdinal("milestone_title")), reader.GetString(reader.GetOrdinal("status_after")),
        reader.GetInt32(reader.GetOrdinal("progress_after")), reader.IsDBNull(reader.GetOrdinal("notes")) ? string.Empty : reader.GetString(reader.GetOrdinal("notes")), reader.GetString(reader.GetOrdinal("contract_manager")),
        reader.GetString(reader.GetOrdinal("recorded_by")), reader.GetDateTime(reader.GetOrdinal("recorded_at")));

    private async Task SyncContractAwardWorkflowRuntimeAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid awardEntityId, ContractAwardItem award, string reason, CancellationToken ct)
    {
        await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest("contract_award", awardEntityId, "award_and_publication", award.Status, award.TenderTitle, null, null, award.AwardValue, null, null, reason, null), ct);
    }

    private async Task SyncContractWorkflowRuntimeAsync(NpgsqlConnection conn, NpgsqlTransaction tx, Guid contractEntityId, ContractManagementItem contract, string reason, CancellationToken ct)
    {
        await _workflowRuntimeTracker.SyncAsync(conn, tx, new WorkflowRuntimeSyncRequest("contract", contractEntityId, ResolveContractWorkflowStage(contract.Status), contract.Status, contract.TenderTitle, null, null, contract.ContractValue, null, null, reason, contract.ContractManager), ct);
    }

    private static string ResolveContractWorkflowStage(string status) => string.Equals(status, "Completed", StringComparison.OrdinalIgnoreCase) ? "inspection_and_payment" : "contract_execution";

    private static async Task<Guid?> GetContractEntityIdAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string contractCode, CancellationToken ct)
    {
        const string sql = "SELECT contract_id FROM post_award.contracts WHERE contract_code = @p_contract_code;";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_contract_code", NpgsqlDbType.Varchar, contractCode);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is Guid value ? value : null;
    }

    private static async Task<Guid?> GetContractAwardEntityIdAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string awardCode, CancellationToken ct)
    {
        const string sql = "SELECT award_id FROM post_award.contract_awards WHERE award_code = @p_award_code;";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_award_code", NpgsqlDbType.Varchar, awardCode);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is Guid value ? value : null;
    }

    private static string? ValidateMilestoneRequest(ContractMilestoneCreateRequest request, out string normalizedStatus, out string? normalizedManager, out string? normalizedRecordedBy)
    {
        normalizedStatus = string.Empty; normalizedManager = null; normalizedRecordedBy = null;
        if (request is null) return "Request body is required.";
        if (string.IsNullOrWhiteSpace(request.MilestoneTitle) || request.MilestoneTitle.Trim().Length > MaxMilestoneTitleLength) return $"MilestoneTitle must be between 1 and {MaxMilestoneTitleLength} characters.";
        if (string.IsNullOrWhiteSpace(request.Notes)) return "Notes are required.";
        if (request.Progress < 0 || request.Progress > 100) return "Progress must be between 0 and 100.";
        var status = AllowedContractStatuses.FirstOrDefault(s => s.Equals(request.Status?.Trim(), StringComparison.OrdinalIgnoreCase));
        if (status is null) return $"Status must be one of: {string.Join(", ", AllowedContractStatuses)}.";
        if (request.ContractManager is not null) { var trimmedManager = request.ContractManager.Trim(); if (trimmedManager.Length == 0 || trimmedManager.Length > MaxContractManagerLength) return $"ContractManager must be between 1 and {MaxContractManagerLength} characters when provided."; normalizedManager = trimmedManager; }
        if (request.RecordedBy is not null) { var trimmedRecordedBy = request.RecordedBy.Trim(); if (trimmedRecordedBy.Length == 0 || trimmedRecordedBy.Length > MaxRecordedByLength) return $"RecordedBy must be between 1 and {MaxRecordedByLength} characters when provided."; normalizedRecordedBy = trimmedRecordedBy; }
        normalizedStatus = status; return null;
    }
}

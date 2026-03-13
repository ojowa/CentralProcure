using System.Data;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.PostAward.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.PostAward.Controllers;

[ApiController]
[Route("api/contracts")]
public class ContractsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<ContractsController> _logger;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private static readonly string[] AllowedContractStatuses = { "Active", "On Hold", "Completed", "Terminated" };
    private const int MaxMilestoneTitleLength = 180;
    private const int MaxContractManagerLength = 150;
    private const int MaxRecordedByLength = 255;

    public ContractsController(
        IConfiguration config,
        ILogger<ContractsController> logger,
        WorkflowRuntimeTracker workflowRuntimeTracker)
    {
        _config = config;
        _logger = logger;
        _workflowRuntimeTracker = workflowRuntimeTracker;
    }

    [HttpGet]
    public async Task<IActionResult> GetContracts([FromQuery] string? status, [FromQuery] string? query, CancellationToken ct)
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
            await using var cmd = new NpgsqlCommand("post_award.get_contracts_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapContract, ct);
            await tx.CommitAsync(ct);

            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting contracts.");
            return Problem("Internal server error retrieving contracts.");
        }
    }

    [HttpGet("{contractId}")]
    public async Task<IActionResult> GetContract(string contractId, CancellationToken ct)
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
            await using var cmd = new NpgsqlCommand("post_award.get_contract_detail_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_contract_code", NpgsqlDbType.Varchar, contractId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapContract, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            return result is null ? NotFound(new { message = "Contract not found." }) : Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting contract {ContractId}.", contractId);
            return Problem("Internal server error retrieving contract.");
        }
    }

    [HttpGet("{contractId}/milestones")]
    public async Task<IActionResult> GetContractMilestones(string contractId, CancellationToken ct)
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
            await using var cmd = new NpgsqlCommand("post_award.get_contract_milestones_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_contract_code", NpgsqlDbType.Varchar, contractId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapContractMilestone, ct);
            await tx.CommitAsync(ct);

            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting milestones for contract {ContractId}.", contractId);
            return Problem("Internal server error retrieving contract milestones.");
        }
    }

    [HttpPost("{contractId}/milestones")]
    public async Task<IActionResult> LogContractMilestone(
        string contractId,
        [FromBody] ContractMilestoneCreateRequest request,
        CancellationToken ct)
    {
        var validationError = ValidateMilestoneRequest(request, out var normalizedStatus, out var normalizedManager, out var normalizedRecordedBy);
        if (validationError is not null)
        {
            return BadRequest(validationError);
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
            await using var cmd = new NpgsqlCommand("post_award.log_contract_milestone_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_contract_code", NpgsqlDbType.Varchar, contractId);
            cmd.Parameters.AddWithValue("p_milestone_title", NpgsqlDbType.Varchar, request.MilestoneTitle.Trim());
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, normalizedStatus);
            cmd.Parameters.AddWithValue("p_progress", NpgsqlDbType.Integer, request.Progress);
            cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, request.Notes.Trim());
            cmd.Parameters.AddWithValue("p_contract_manager", NpgsqlDbType.Varchar, (object?)normalizedManager ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_recorded_by", NpgsqlDbType.Varchar, (object?)normalizedRecordedBy ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapContract, ct);
            var result = results.FirstOrDefault();
            if (result is null)
            {
                return NotFound(new { message = "Contract not found." });
            }

            var contractEntityId = await GetContractEntityIdAsync(conn, tx, contractId, ct);
            if (!contractEntityId.HasValue)
            {
                return NotFound(new { message = "Contract not found." });
            }

            await SyncContractWorkflowRuntimeAsync(conn, tx, contractEntityId.Value, result, "Contract milestone recorded.", ct);
            await tx.CommitAsync(ct);
            return Ok(result);
        }
        catch (PostgresException ex) when (ex.SqlState == "P0001")
        {
            _logger.LogWarning(ex, "Contract milestone validation failed for contract {ContractId}.", contractId);
            return BadRequest(ex.MessageText);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error logging milestone for contract {ContractId}.", contractId);
            return Problem("Internal server error logging contract milestone.");
        }
    }

    [HttpGet("awards")]
    public async Task<IActionResult> GetAwards([FromQuery] string? status, [FromQuery] string? query, CancellationToken ct)
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
            await using var cmd = new NpgsqlCommand("post_award.get_contract_awards_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapContractAward, ct);
            await tx.CommitAsync(ct);

            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting contract awards.");
            return Problem("Internal server error retrieving contract awards.");
        }
    }

    [HttpGet("awards/{awardId}")]
    public async Task<IActionResult> GetAward(string awardId, CancellationToken ct)
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
            await using var cmd = new NpgsqlCommand("post_award.get_contract_award_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_award_code", NpgsqlDbType.Varchar, awardId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapContractAward, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            return result is null ? NotFound(new { message = "Award not found." }) : Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting award {AwardId}.", awardId);
            return Problem("Internal server error retrieving award.");
        }
    }

    [HttpPost("awards/{awardId}/publish")]
    public async Task<IActionResult> PublishAward(string awardId, CancellationToken ct)
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
            await using var cmd = new NpgsqlCommand("post_award.publish_contract_award_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_award_code", NpgsqlDbType.Varchar, awardId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapContractAward, ct);
            var result = results.FirstOrDefault();
            if (result is null)
            {
                return NotFound(new { message = "Award not found." });
            }

            var awardEntityId = await GetContractAwardEntityIdAsync(conn, tx, awardId, ct);
            if (!awardEntityId.HasValue)
            {
                return NotFound(new { message = "Award not found." });
            }

            await SyncContractAwardWorkflowRuntimeAsync(conn, tx, awardEntityId.Value, result, "Contract award published.", ct);
            await tx.CommitAsync(ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing award {AwardId}.", awardId);
            return Problem("Internal server error publishing award.");
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

    private static ContractAwardItem MapContractAward(NpgsqlDataReader reader)
    {
        return new ContractAwardItem(
            reader.GetString(reader.GetOrdinal("award_code")),
            reader.GetString(reader.GetOrdinal("tender_title")),
            reader.GetString(reader.GetOrdinal("vendor_name")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("award_value")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.GetDateTime(reader.GetOrdinal("award_date")),
            reader.GetDateTime(reader.GetOrdinal("contract_start")),
            reader.GetDateTime(reader.GetOrdinal("contract_end")),
            reader.GetString(reader.GetOrdinal("funding_source")),
            reader.IsDBNull(reader.GetOrdinal("notes")) ? string.Empty : reader.GetString(reader.GetOrdinal("notes"))
        );
    }

    private static ContractManagementItem MapContract(NpgsqlDataReader reader)
    {
        return new ContractManagementItem(
            reader.GetString(reader.GetOrdinal("contract_code")),
            reader.GetString(reader.GetOrdinal("tender_title")),
            reader.GetString(reader.GetOrdinal("vendor_name")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("contract_value")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.GetDateTime(reader.GetOrdinal("start_date")),
            reader.GetDateTime(reader.GetOrdinal("end_date")),
            reader.GetInt32(reader.GetOrdinal("progress")),
            reader.GetString(reader.GetOrdinal("contract_manager")),
            reader.IsDBNull(reader.GetOrdinal("notes")) ? string.Empty : reader.GetString(reader.GetOrdinal("notes"))
        );
    }

    private static ContractMilestoneItem MapContractMilestone(NpgsqlDataReader reader)
    {
        return new ContractMilestoneItem(
            reader.GetGuid(reader.GetOrdinal("milestone_id")),
            reader.GetString(reader.GetOrdinal("contract_code")),
            reader.GetString(reader.GetOrdinal("milestone_title")),
            reader.GetString(reader.GetOrdinal("status_after")),
            reader.GetInt32(reader.GetOrdinal("progress_after")),
            reader.IsDBNull(reader.GetOrdinal("notes")) ? string.Empty : reader.GetString(reader.GetOrdinal("notes")),
            reader.GetString(reader.GetOrdinal("contract_manager")),
            reader.GetString(reader.GetOrdinal("recorded_by")),
            reader.GetDateTime(reader.GetOrdinal("recorded_at"))
        );
    }

    private async Task SyncContractAwardWorkflowRuntimeAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid awardEntityId,
        ContractAwardItem award,
        string reason,
        CancellationToken ct)
    {
        await _workflowRuntimeTracker.SyncAsync(
            conn,
            tx,
            new WorkflowRuntimeSyncRequest(
                "contract_award",
                awardEntityId,
                "award_and_publication",
                award.Status,
                award.TenderTitle,
                null,
                null,
                award.AwardValue,
                null,
                null,
                reason,
                null),
            ct);
    }

    private async Task SyncContractWorkflowRuntimeAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid contractEntityId,
        ContractManagementItem contract,
        string reason,
        CancellationToken ct)
    {
        await _workflowRuntimeTracker.SyncAsync(
            conn,
            tx,
            new WorkflowRuntimeSyncRequest(
                "contract",
                contractEntityId,
                "contract_execution",
                contract.Status,
                contract.TenderTitle,
                null,
                null,
                contract.ContractValue,
                null,
                null,
                reason,
                contract.ContractManager),
            ct);
    }

    private static async Task<Guid?> GetContractEntityIdAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string contractCode,
        CancellationToken ct)
    {
        const string sql = "SELECT contract_id FROM post_award.contracts WHERE contract_code = @p_contract_code;";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_contract_code", NpgsqlDbType.Varchar, contractCode);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is Guid value ? value : null;
    }

    private static async Task<Guid?> GetContractAwardEntityIdAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string awardCode,
        CancellationToken ct)
    {
        const string sql = "SELECT award_id FROM post_award.contract_awards WHERE award_code = @p_award_code;";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_award_code", NpgsqlDbType.Varchar, awardCode);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is Guid value ? value : null;
    }

    private static string? ValidateMilestoneRequest(
        ContractMilestoneCreateRequest request,
        out string normalizedStatus,
        out string? normalizedManager,
        out string? normalizedRecordedBy)
    {
        normalizedStatus = string.Empty;
        normalizedManager = null;
        normalizedRecordedBy = null;

        if (request is null)
        {
            return "Request body is required.";
        }

        if (string.IsNullOrWhiteSpace(request.MilestoneTitle) || request.MilestoneTitle.Trim().Length > MaxMilestoneTitleLength)
        {
            return $"MilestoneTitle must be between 1 and {MaxMilestoneTitleLength} characters.";
        }

        if (string.IsNullOrWhiteSpace(request.Notes))
        {
            return "Notes are required.";
        }

        if (request.Progress < 0 || request.Progress > 100)
        {
            return "Progress must be between 0 and 100.";
        }

        var status = AllowedContractStatuses.FirstOrDefault(s => s.Equals(request.Status?.Trim(), StringComparison.OrdinalIgnoreCase));
        if (status is null)
        {
            return $"Status must be one of: {string.Join(", ", AllowedContractStatuses)}.";
        }

        if (request.ContractManager is not null)
        {
            var trimmedManager = request.ContractManager.Trim();
            if (trimmedManager.Length == 0 || trimmedManager.Length > MaxContractManagerLength)
            {
                return $"ContractManager must be between 1 and {MaxContractManagerLength} characters when provided.";
            }

            normalizedManager = trimmedManager;
        }

        if (request.RecordedBy is not null)
        {
            var trimmedRecordedBy = request.RecordedBy.Trim();
            if (trimmedRecordedBy.Length == 0 || trimmedRecordedBy.Length > MaxRecordedByLength)
            {
                return $"RecordedBy must be between 1 and {MaxRecordedByLength} characters when provided.";
            }

            normalizedRecordedBy = trimmedRecordedBy;
        }

        normalizedStatus = status;
        return null;
    }
}

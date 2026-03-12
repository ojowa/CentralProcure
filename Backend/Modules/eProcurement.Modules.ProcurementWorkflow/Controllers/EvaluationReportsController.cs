using System.Data;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/evaluation-reports")]
public class EvaluationReportsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<EvaluationReportsController> _logger;

    public EvaluationReportsController(IConfiguration config, ILogger<EvaluationReportsController> logger)
    {
        _config = config;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetReports([FromQuery] string? status, [FromQuery] string? query, CancellationToken ct)
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
            await using var cmd = new NpgsqlCommand("procurement_workflow.get_evaluation_reports_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapReport, ct);
            await tx.CommitAsync(ct);

            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting evaluation reports.");
            return Problem("Internal server error retrieving evaluation reports.");
        }
    }

    [HttpGet("{reportId}")]
    public async Task<IActionResult> GetReport(string reportId, CancellationToken ct)
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
            await using var cmd = new NpgsqlCommand("procurement_workflow.get_evaluation_report_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_report_code", NpgsqlDbType.Varchar, reportId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapReport, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            return result is null ? NotFound(new { message = "Evaluation report not found." }) : Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting evaluation report {ReportId}.", reportId);
            return Problem("Internal server error retrieving evaluation report.");
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

    private static EvaluationReportItem MapReport(NpgsqlDataReader reader)
    {
        return new EvaluationReportItem(
            reader.GetString(reader.GetOrdinal("report_code")),
            reader.GetGuid(reader.GetOrdinal("tender_id")),
            reader.GetString(reader.GetOrdinal("tender_title")),
            reader.GetString(reader.GetOrdinal("committee_lead")),
            reader.GetString(reader.GetOrdinal("recommendation")),
            reader.GetString(reader.GetOrdinal("score_summary")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.GetDateTime(reader.GetOrdinal("submitted_at")),
            reader.IsDBNull(reader.GetOrdinal("notes")) ? string.Empty : reader.GetString(reader.GetOrdinal("notes"))
        );
    }
}

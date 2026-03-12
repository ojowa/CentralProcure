using System.Data;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.PostAward.DTOs;

namespace eProcurement.Modules.PostAward.Controllers;

[ApiController]
[Route("api/inspections")]
public class InspectionsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<InspectionsController> _logger;

    public InspectionsController(IConfiguration config, ILogger<InspectionsController> logger)
    {
        _config = config;
        _logger = logger;
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
}

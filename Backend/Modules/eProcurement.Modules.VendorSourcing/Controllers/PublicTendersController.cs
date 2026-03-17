using System.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.VendorSourcing.Controllers;

public record PublicTenderSummary(
    string Id,
    string Title,
    string ProcurementCategory,
    string Status,
    string SubmissionDeadline);

public record PublicTenderDocument(string Id, string Name, string Type, string Url);

public record PublicTenderDetails(
    string Id,
    string Title,
    string ProcurementCategory,
    string Status,
    string SubmissionDeadline,
    string OpeningDate,
    string ClosingDate,
    string Description,
    string Specifications,
    decimal? Budget,
    PublicTenderDocument[] Documents,
    string EligibilityCriteria,
    string EvaluationCriteria);

[ApiController]
[Route("api/Tender")]
public class PublicTendersController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<PublicTendersController> _logger;

    public PublicTendersController(IConfiguration config, ILogger<PublicTendersController> logger)
    {
        _config = config;
        _logger = logger;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    [AllowAnonymous]
    [HttpGet("open")]
    public async Task<IActionResult> GetOpenTenders(CancellationToken ct)
    {
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
            await using var cmd = new NpgsqlCommand("vendor_sourcing.get_open_tenders_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var items = await ExecuteRefcursorAsync(cmd, MapOpenSummary, ct);
            await tx.CommitAsync(ct);

            return Ok(items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving open tenders.");
            return Problem(ex.Message, statusCode: 500, title: "Internal server error retrieving open tenders.");
        }
    }

    [AllowAnonymous]
    [HttpGet("{tenderId:guid}")]
    public async Task<IActionResult> GetTender(Guid tenderId, CancellationToken ct)
    {
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
            await using var cmd = new NpgsqlCommand("vendor_sourcing.get_tender_details_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapTenderDetail, ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            return result is null ? NotFound() : Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving tender {TenderId}.", tenderId);
            return Problem(ex.Message, statusCode: 500, title: "Internal server error retrieving tender.");
        }
    }

    private static async Task<List<T>> ExecuteRefcursorAsync<T>(NpgsqlCommand cmd, Func<NpgsqlDataReader, T> map, CancellationToken ct)
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

    private static PublicTenderSummary MapOpenSummary(NpgsqlDataReader reader)
    {
        var category = GetNullableString(reader, "category") ?? "Goods";
        var status = GetNullableString(reader, "status") ?? "Published";
        var closingDate = GetNullableDateTime(reader, "closing_date");

        return new PublicTenderSummary(
            reader.GetGuid(reader.GetOrdinal("tender_id")).ToString(),
            GetNullableString(reader, "title") ?? "Untitled Tender",
            MapCategory(category),
            MapStatus(status),
            (closingDate ?? DateTime.UtcNow).ToString("O"));
    }

    private static PublicTenderDetails MapTenderDetail(NpgsqlDataReader reader)
    {
        var category = GetNullableString(reader, "category") ?? "Goods";
        var status = GetNullableString(reader, "status") ?? "Published";
        var openingDate = GetNullableDateTime(reader, "opening_date");
        var closingDate = GetNullableDateTime(reader, "closing_date");

        return new PublicTenderDetails(
            reader.GetGuid(reader.GetOrdinal("tender_id")).ToString(),
            GetNullableString(reader, "title") ?? "Untitled Tender",
            MapCategory(category),
            MapStatus(status),
            (closingDate ?? DateTime.UtcNow).ToString("O"),
            openingDate?.ToString("O") ?? string.Empty,
            closingDate?.ToString("O") ?? string.Empty,
            GetNullableString(reader, "description") ?? string.Empty,
            GetNullableString(reader, "specifications") ?? string.Empty,
            GetNullableDecimal(reader, "budget"),
            Array.Empty<PublicTenderDocument>(),
            GetNullableString(reader, "eligibility_criteria") ?? string.Empty,
            GetNullableString(reader, "evaluation_criteria") ?? string.Empty);
    }

    private static string MapStatus(string status)
    {
        return status switch
        {
            "Published" => "Open",
            "Closed" => "Closed",
            "Awarded" => "Awarded",
            "Cancelled" => "Cancelled",
            _ => "Open"
        };
    }

    private static string MapCategory(string category)
    {
        var normalized = category.ToLowerInvariant();
        if (normalized.Contains("work") || normalized.Contains("construction") || normalized.Contains("renovation"))
        {
            return "Works";
        }

        if (normalized.Contains("service") || normalized.Contains("training") || normalized.Contains("maintenance"))
        {
            return "Services";
        }

        return "Goods";
    }

    private static string? GetNullableString(NpgsqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    private static DateTime? GetNullableDateTime(NpgsqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
    }

    private static decimal? GetNullableDecimal(NpgsqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetFieldValue<decimal>(ordinal);
    }
}

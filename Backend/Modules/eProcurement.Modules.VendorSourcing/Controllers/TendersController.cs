using System.Data;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.VendorSourcing.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.VendorSourcing.Controllers;

[ApiController]
[Route("api/tenders")]
[Route("api/internal/tenders")]
public partial class TendersController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<TendersController> _logger;
    private readonly WorkflowPolicyGuard _workflowPolicyGuard;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;
    private readonly WorkflowActionGrantService _workflowActionGrantService;

    private static readonly string[] AllowedStatuses = { "Draft", "Published", "Closed", "Awarded", "Cancelled" };
    private static readonly HashSet<string> AllowedSortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "created_at",
        "title",
        "category",
        "status",
        "budget",
        "publish_date",
        "closing_date"
    };
    private static readonly HashSet<string> AllowedSortDirections = new(StringComparer.OrdinalIgnoreCase) { "asc", "desc" };
    private const int DefaultPageSize = 10;
    private const int MaxPageSize = 100;
    private const int MaxDepartmentLength = 150;
    private const int MaxBudgetCodeLength = 60;

    public TendersController(
        IConfiguration config,
        ILogger<TendersController> logger,
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

    [HttpGet]
    public async Task<IActionResult> GetTenders(
        [FromQuery] string? status,
        [FromQuery] string? category,
        [FromQuery] string? query,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        [FromQuery] string? sortBy = "created_at",
        [FromQuery] string? sortDir = "desc",
        CancellationToken ct = default)
    {
        if (!IsStatusValid(status, out _))
        {
            return BadRequest($"Status must be one of: {string.Join(", ", AllowedStatuses)}.");
        }

        if (page < 1)
        {
            return BadRequest("Page must be 1 or greater.");
        }

        if (pageSize < 1 || pageSize > MaxPageSize)
        {
            return BadRequest($"PageSize must be between 1 and {MaxPageSize}.");
        }

        sortBy = string.IsNullOrWhiteSpace(sortBy) ? "created_at" : sortBy.Trim().ToLowerInvariant();
        sortDir = string.IsNullOrWhiteSpace(sortDir) ? "desc" : sortDir.Trim().ToLowerInvariant();
        if (!AllowedSortFields.Contains(sortBy))
        {
            return BadRequest($"SortBy must be one of: {string.Join(", ", AllowedSortFields)}.");
        }

        if (!AllowedSortDirections.Contains(sortDir))
        {
            return BadRequest("SortDir must be 'asc' or 'desc'.");
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

            var total = await GetTenderCountAsync(conn, tx, status, category, query, ct);
            const string sql = """
SELECT *
FROM vendor_sourcing.get_tenders(
    @p_status,
    @p_category,
    @p_query,
    @p_sort_by,
    @p_sort_dir,
    @p_limit,
    @p_offset
);
""";

            await using var cmd = new NpgsqlCommand(sql, conn, tx);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_category", NpgsqlDbType.Varchar, (object?)category ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_sort_by", NpgsqlDbType.Varchar, sortBy);
            cmd.Parameters.AddWithValue("p_sort_dir", NpgsqlDbType.Varchar, sortDir);
            cmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, pageSize);
            cmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, (page - 1) * pageSize);

            var items = await ExecuteQueryAsync(cmd, MapTenderSummary, ct);
            await tx.CommitAsync(ct);
            return Ok(new TenderListResponse(items, page, pageSize, total));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving tenders.");
            return Problem("Internal server error retrieving tenders.");
        }
    }

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
            const string sql = """
SELECT *
FROM vendor_sourcing.get_tender_details(@p_tender_id);
""";

            await using var cmd = new NpgsqlCommand(sql, conn, tx);
            cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);

            var results = await ExecuteQueryAsync(cmd, MapTenderDetail, ct);
            await tx.CommitAsync(ct);
            return results.FirstOrDefault() is { } result ? Ok(result) : NotFound();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving tender {TenderId}.", tenderId);
            return Problem("Internal server error retrieving tender.");
        }
    }
}

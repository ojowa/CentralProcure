using System.Data;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.VendorSourcing.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.VendorSourcing.Controllers;

[ApiController]
[Route("api/tenders")]
public class TendersController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<TendersController> _logger;
    private readonly WorkflowRuntimeTracker _workflowRuntimeTracker;

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
        WorkflowRuntimeTracker workflowRuntimeTracker)
    {
        _config = config;
        _logger = logger;
        _workflowRuntimeTracker = workflowRuntimeTracker;
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

            await using var cmd = new NpgsqlCommand("vendor_sourcing.get_tenders_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_category", NpgsqlDbType.Varchar, (object?)category ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_sort_by", NpgsqlDbType.Varchar, sortBy);
            cmd.Parameters.AddWithValue("p_sort_dir", NpgsqlDbType.Varchar, sortDir);
            cmd.Parameters.AddWithValue("p_limit", NpgsqlDbType.Integer, pageSize);
            cmd.Parameters.AddWithValue("p_offset", NpgsqlDbType.Integer, (page - 1) * pageSize);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var items = await ExecuteRefcursorAsync(cmd, MapTenderSummary, ct);
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
            return Problem("Internal server error retrieving tender.");
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateTender([FromBody] TenderCreateRequest request, CancellationToken ct)
    {
        var validationError = ValidateCreateRequest(request, out var normalizedStatus);
        if (validationError is not null)
        {
            return BadRequest(validationError);
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
            await using var cmd = new NpgsqlCommand("vendor_sourcing.create_tender_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_title", NpgsqlDbType.Varchar, request.Title);
            cmd.Parameters.AddWithValue("p_description", NpgsqlDbType.Text, request.Description);
            cmd.Parameters.AddWithValue("p_category", NpgsqlDbType.Varchar, request.Category);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_budget", NpgsqlDbType.Numeric, (object?)request.Budget ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)request.Department ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, (object?)request.BudgetCode ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)request.FiscalYear ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_specifications", NpgsqlDbType.Text, (object?)request.Specifications ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_eligibility_criteria", NpgsqlDbType.Text, (object?)request.EligibilityCriteria ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_evaluation_criteria", NpgsqlDbType.Text, (object?)request.EvaluationCriteria ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_publish_date", NpgsqlDbType.Timestamp, (object?)request.PublishDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_opening_date", NpgsqlDbType.Timestamp, (object?)request.OpeningDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_closing_date", NpgsqlDbType.Timestamp, (object?)request.ClosingDate ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapTenderDetail, ct);
            var result = results.FirstOrDefault();
            if (result is null)
            {
                return Problem("Tender creation failed.");
            }

            await SyncWorkflowRuntimeAsync(conn, tx, result, "Tender created.", ct);
            await tx.CommitAsync(ct);
            return Created($"/api/tenders/{result.TenderId}", result);
        }
        catch (PostgresException ex) when (ex.SqlState == "P0001")
        {
            _logger.LogWarning(ex, "Budget validation failed while creating tender.");
            return Conflict(ex.MessageText);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating tender.");
            return Problem("Internal server error creating tender.");
        }
    }

    [HttpPut("{tenderId:guid}")]
    public async Task<IActionResult> UpdateTender(Guid tenderId, [FromBody] TenderUpdateRequest request, CancellationToken ct)
    {
        var validationError = ValidateUpdateRequest(request, out var normalizedStatus);
        if (validationError is not null)
        {
            return BadRequest(validationError);
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
            await using var cmd = new NpgsqlCommand("vendor_sourcing.update_tender_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);
            cmd.Parameters.AddWithValue("p_title", NpgsqlDbType.Varchar, (object?)request.Title ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_description", NpgsqlDbType.Text, (object?)request.Description ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_category", NpgsqlDbType.Varchar, (object?)request.Category ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_budget", NpgsqlDbType.Numeric, (object?)request.Budget ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_department", NpgsqlDbType.Varchar, (object?)request.Department ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, (object?)request.BudgetCode ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_fiscal_year", NpgsqlDbType.Integer, (object?)request.FiscalYear ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_specifications", NpgsqlDbType.Text, (object?)request.Specifications ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_eligibility_criteria", NpgsqlDbType.Text, (object?)request.EligibilityCriteria ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_evaluation_criteria", NpgsqlDbType.Text, (object?)request.EvaluationCriteria ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_publish_date", NpgsqlDbType.Timestamp, (object?)request.PublishDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_opening_date", NpgsqlDbType.Timestamp, (object?)request.OpeningDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_closing_date", NpgsqlDbType.Timestamp, (object?)request.ClosingDate ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapTenderDetail, ct);
            var result = results.FirstOrDefault();
            if (result is null)
            {
                return NotFound();
            }

            await SyncWorkflowRuntimeAsync(conn, tx, result, "Tender updated.", ct);
            await tx.CommitAsync(ct);
            return Ok(result);
        }
        catch (PostgresException ex) when (ex.SqlState == "P0001")
        {
            _logger.LogWarning(ex, "Budget validation failed while updating tender {TenderId}.", tenderId);
            return Conflict(ex.MessageText);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating tender {TenderId}.", tenderId);
            return Problem("Internal server error updating tender.");
        }
    }

    [HttpPost("{tenderId:guid}/publish")]
    public async Task<IActionResult> PublishTender(Guid tenderId, [FromBody] TenderPublishRequest request, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        if (request.OpeningDate.HasValue && request.ClosingDate.HasValue && request.ClosingDate < request.OpeningDate)
        {
            return BadRequest("ClosingDate cannot be earlier than OpeningDate.");
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using var cmd = new NpgsqlCommand("vendor_sourcing.publish_tender_sp", conn, tx)
            {
                CommandType = CommandType.StoredProcedure
            };

            cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);
            cmd.Parameters.AddWithValue("p_publish_date", NpgsqlDbType.Timestamp, (object?)request.PublishDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_opening_date", NpgsqlDbType.Timestamp, (object?)request.OpeningDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_closing_date", NpgsqlDbType.Timestamp, (object?)request.ClosingDate ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("p_result", NpgsqlDbType.Refcursor)
            {
                Direction = ParameterDirection.Output
            });

            var results = await ExecuteRefcursorAsync(cmd, MapTenderDetail, ct);
            var result = results.FirstOrDefault();
            if (result is null)
            {
                return NotFound();
            }

            await SyncWorkflowRuntimeAsync(conn, tx, result, "Tender published.", ct);
            await tx.CommitAsync(ct);
            return Ok(result);
        }
        catch (PostgresException ex) when (ex.SqlState == "P0001")
        {
            _logger.LogWarning(ex, "Budget validation failed while publishing tender {TenderId}.", tenderId);
            return Conflict(ex.MessageText);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing tender {TenderId}.", tenderId);
            return Problem("Internal server error publishing tender.");
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

    private static TenderSummary MapTenderSummary(NpgsqlDataReader r)
    {
        return new TenderSummary(
            r.GetGuid(r.GetOrdinal("tender_id")),
            r.GetString(r.GetOrdinal("title")),
            r.GetString(r.GetOrdinal("category")),
            r.GetString(r.GetOrdinal("status")),
            GetNullableDecimal(r, "budget"),
            GetNullableString(r, "department"),
            GetNullableString(r, "budget_code"),
            GetNullableInt(r, "fiscal_year"),
            GetNullableDateTime(r, "publish_date"),
            GetNullableDateTime(r, "opening_date"),
            GetNullableDateTime(r, "closing_date"),
            r.GetDateTime(r.GetOrdinal("created_at")));
    }

    private static TenderDetail MapTenderDetail(NpgsqlDataReader r)
    {
        return new TenderDetail(
            r.GetGuid(r.GetOrdinal("tender_id")),
            r.GetString(r.GetOrdinal("title")),
            r.GetString(r.GetOrdinal("description")),
            r.GetString(r.GetOrdinal("category")),
            r.GetString(r.GetOrdinal("status")),
            GetNullableDecimal(r, "budget"),
            GetNullableString(r, "department"),
            GetNullableString(r, "budget_code"),
            GetNullableInt(r, "fiscal_year"),
            GetNullableString(r, "specifications"),
            GetNullableString(r, "eligibility_criteria"),
            GetNullableString(r, "evaluation_criteria"),
            GetNullableDateTime(r, "publish_date"),
            GetNullableDateTime(r, "opening_date"),
            GetNullableDateTime(r, "closing_date"),
            r.GetDateTime(r.GetOrdinal("created_at")),
            r.GetDateTime(r.GetOrdinal("updated_at")));
    }

    private static string? GetNullableString(NpgsqlDataReader r, string n)
    {
        var ordinal = r.GetOrdinal(n);
        return r.IsDBNull(ordinal) ? null : r.GetString(ordinal);
    }

    private static DateTime? GetNullableDateTime(NpgsqlDataReader r, string n)
    {
        var ordinal = r.GetOrdinal(n);
        return r.IsDBNull(ordinal) ? null : r.GetDateTime(ordinal);
    }

    private static decimal? GetNullableDecimal(NpgsqlDataReader r, string n)
    {
        var ordinal = r.GetOrdinal(n);
        return r.IsDBNull(ordinal) ? null : r.GetFieldValue<decimal>(ordinal);
    }

    private static int? GetNullableInt(NpgsqlDataReader r, string n)
    {
        var ordinal = r.GetOrdinal(n);
        return r.IsDBNull(ordinal) ? null : r.GetInt32(ordinal);
    }

    private async Task SyncWorkflowRuntimeAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        TenderDetail tender,
        string reason,
        CancellationToken ct)
    {
        await _workflowRuntimeTracker.SyncAsync(
            conn,
            tx,
            new WorkflowRuntimeSyncRequest(
                "tender",
                tender.TenderId,
                ResolveWorkflowStage(tender.Status),
                tender.Status,
                tender.Title,
                null,
                null,
                tender.Budget,
                null,
                null,
                reason,
                null),
            ct);
    }

    private static string ResolveWorkflowStage(string status)
    {
        return status switch
        {
            "Draft" => "method_validation",
            "Published" => "solicitation",
            "Closed" => "bid_opening",
            "Awarded" => "award_and_publication",
            _ => "solicitation"
        };
    }

    private static bool IsStatusValid(string? status, out string? normalized)
    {
        normalized = null;
        if (string.IsNullOrWhiteSpace(status))
        {
            return true;
        }

        var trimmed = status.Trim();
        var match = AllowedStatuses.FirstOrDefault(s => string.Equals(s, trimmed, StringComparison.OrdinalIgnoreCase));
        if (match is null)
        {
            return false;
        }

        normalized = match;
        return true;
    }

    private static string? ValidateCreateRequest(TenderCreateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = null;

        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length < 5)
        {
            return "Title must be at least 5 characters.";
        }

        if (string.IsNullOrWhiteSpace(request.Description) || request.Description.Trim().Length < 10)
        {
            return "Description must be at least 10 characters.";
        }

        if (string.IsNullOrWhiteSpace(request.Category) || request.Category.Trim().Length < 3)
        {
            return "Category must be at least 3 characters.";
        }

        if (request.Budget.HasValue && request.Budget.Value < 0)
        {
            return "Budget cannot be negative.";
        }

        if (!string.IsNullOrWhiteSpace(request.Department) && request.Department.Trim().Length > MaxDepartmentLength)
        {
            return $"Department must be {MaxDepartmentLength} characters or fewer.";
        }

        if (!string.IsNullOrWhiteSpace(request.BudgetCode) && request.BudgetCode.Trim().Length > MaxBudgetCodeLength)
        {
            return $"BudgetCode must be {MaxBudgetCodeLength} characters or fewer.";
        }

        if (!IsStatusValid(request.Status, out normalizedStatus))
        {
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
        }

        var requiresBudget = normalizedStatus is "Published" or "Closed" or "Awarded";
        if (requiresBudget)
        {
            if (!request.Budget.HasValue || request.Budget.Value <= 0)
            {
                return "Budget must be greater than 0 for this status.";
            }

            if (string.IsNullOrWhiteSpace(request.Department))
            {
                return "Department is required for this status.";
            }

            if (string.IsNullOrWhiteSpace(request.BudgetCode))
            {
                return "BudgetCode is required for this status.";
            }
        }

        if (request.OpeningDate.HasValue && request.ClosingDate.HasValue && request.ClosingDate < request.OpeningDate)
        {
            return "ClosingDate cannot be earlier than OpeningDate.";
        }

        return null;
    }

    private static string? ValidateUpdateRequest(TenderUpdateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = null;

        var hasAny =
            request.Title is not null ||
            request.Description is not null ||
            request.Category is not null ||
            request.Status is not null ||
            request.Budget.HasValue ||
            request.Specifications is not null ||
            request.EligibilityCriteria is not null ||
            request.EvaluationCriteria is not null ||
            request.PublishDate.HasValue ||
            request.OpeningDate.HasValue ||
            request.ClosingDate.HasValue;

        if (!hasAny)
        {
            return "At least one field is required to update a tender.";
        }

        if (request.Title is not null && request.Title.Trim().Length < 5)
        {
            return "Title must be at least 5 characters.";
        }

        if (request.Description is not null && request.Description.Trim().Length < 10)
        {
            return "Description must be at least 10 characters.";
        }

        if (request.Category is not null && request.Category.Trim().Length < 3)
        {
            return "Category must be at least 3 characters.";
        }

        if (request.Budget.HasValue && request.Budget.Value < 0)
        {
            return "Budget cannot be negative.";
        }

        if (request.Department is not null && request.Department.Trim().Length > MaxDepartmentLength)
        {
            return $"Department must be {MaxDepartmentLength} characters or fewer.";
        }

        if (request.BudgetCode is not null && request.BudgetCode.Trim().Length > MaxBudgetCodeLength)
        {
            return $"BudgetCode must be {MaxBudgetCodeLength} characters or fewer.";
        }

        if (!IsStatusValid(request.Status, out normalizedStatus))
        {
            return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
        }

        if (normalizedStatus is "Published" or "Closed" or "Awarded")
        {
            if (request.Budget.HasValue && request.Budget.Value <= 0)
            {
                return "Budget must be greater than 0 for this status.";
            }

            if (request.Department is not null && string.IsNullOrWhiteSpace(request.Department))
            {
                return "Department is required for this status.";
            }

            if (request.BudgetCode is not null && string.IsNullOrWhiteSpace(request.BudgetCode))
            {
                return "BudgetCode is required for this status.";
            }
        }

        if (request.OpeningDate.HasValue && request.ClosingDate.HasValue && request.ClosingDate < request.OpeningDate)
        {
            return "ClosingDate cannot be earlier than OpeningDate.";
        }

        return null;
    }

    private static async Task<long> GetTenderCountAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string? status,
        string? category,
        string? query,
        CancellationToken ct)
    {
        const string sql = "SELECT vendor_sourcing.get_tenders_count(@p_status, @p_category, @p_query);";
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_category", NpgsqlDbType.Varchar, (object?)category ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_query", NpgsqlDbType.Text, (object?)query ?? DBNull.Value);

        var result = await cmd.ExecuteScalarAsync(ct);
        return result is null ? 0 : Convert.ToInt64(result);
    }
}


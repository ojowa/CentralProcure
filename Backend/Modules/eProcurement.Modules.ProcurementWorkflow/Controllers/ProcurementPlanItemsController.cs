using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
public class ProcurementPlanItemsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<ProcurementPlanItemsController> _logger;

    private static readonly string[] AllowedStatuses = { "Active", "Inactive", "Cancelled" };
    private static readonly string[] AllowedProcurementTypes = { "Goods", "Works", "Services" };
    private const int MaxBudgetCodeLength = 60;

    public ProcurementPlanItemsController(IConfiguration config, ILogger<ProcurementPlanItemsController> logger)
    {
        _config = config;
        _logger = logger;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    [HttpGet("api/procurement-plans/{planId:guid}/items")]
    public async Task<IActionResult> GetPlanItems(Guid planId, CancellationToken ct)
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
            var results = await ExecuteStoredProcedureAsync(
                conn,
                tx,
                "CALL procurement_workflow.get_procurement_plan_items_sp(@p_plan_id, NULL::refcursor);",
                parameters =>
                {
                    parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
                },
                MapPlanItem,
                ct);
            await tx.CommitAsync(ct);

            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving procurement plan items for {PlanId}.", planId);
            return Problem("Internal server error retrieving procurement plan items.");
        }
    }

    [HttpPost("api/procurement-plans/{planId:guid}/items")]
    public async Task<IActionResult> CreatePlanItem(Guid planId, [FromBody] ProcurementPlanItemCreateRequest request, CancellationToken ct)
    {
        var validationError = ValidateCreateRequest(request, out var normalizedStatus, out var normalizedType);
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
            var results = await ExecuteStoredProcedureAsync(
                conn,
                tx,
                "CALL procurement_workflow.create_procurement_plan_item_sp(@p_plan_id, @p_item_code, @p_description, @p_budget_code, @p_procurement_type, @p_estimated_amount, @p_status, @p_notes, NULL::refcursor);",
                parameters =>
                {
                    parameters.AddWithValue("p_plan_id", NpgsqlDbType.Uuid, planId);
                    parameters.AddWithValue("p_item_code", NpgsqlDbType.Varchar, (object?)request.ItemCode ?? DBNull.Value);
                    parameters.AddWithValue("p_description", NpgsqlDbType.Text, request.Description);
                    parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, request.BudgetCode);
                    parameters.AddWithValue("p_procurement_type", NpgsqlDbType.Varchar, (object?)normalizedType ?? DBNull.Value);
                    parameters.AddWithValue("p_estimated_amount", NpgsqlDbType.Numeric, (object?)request.EstimatedAmount ?? DBNull.Value);
                    parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
                    parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)request.Notes ?? DBNull.Value);
                },
                MapPlanItem,
                ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            return result is null ? Problem("Procurement plan item creation failed.") : Created($"/api/procurement-plan-items/{result.PlanItemId}", result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating procurement plan item for {PlanId}.", planId);
            return Problem("Internal server error creating procurement plan item.");
        }
    }

    [HttpPut("api/procurement-plan-items/{planItemId:guid}")]
    public async Task<IActionResult> UpdatePlanItem(Guid planItemId, [FromBody] ProcurementPlanItemUpdateRequest request, CancellationToken ct)
    {
        var validationError = ValidateUpdateRequest(request, out var normalizedStatus, out var normalizedType);
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
            var results = await ExecuteStoredProcedureAsync(
                conn,
                tx,
                "CALL procurement_workflow.update_procurement_plan_item_sp(@p_plan_item_id, @p_item_code, @p_description, @p_budget_code, @p_procurement_type, @p_estimated_amount, @p_status, @p_notes, NULL::refcursor);",
                parameters =>
                {
                    parameters.AddWithValue("p_plan_item_id", NpgsqlDbType.Uuid, planItemId);
                    parameters.AddWithValue("p_item_code", NpgsqlDbType.Varchar, (object?)request.ItemCode ?? DBNull.Value);
                    parameters.AddWithValue("p_description", NpgsqlDbType.Text, (object?)request.Description ?? DBNull.Value);
                    parameters.AddWithValue("p_budget_code", NpgsqlDbType.Varchar, (object?)request.BudgetCode ?? DBNull.Value);
                    parameters.AddWithValue("p_procurement_type", NpgsqlDbType.Varchar, (object?)normalizedType ?? DBNull.Value);
                    parameters.AddWithValue("p_estimated_amount", NpgsqlDbType.Numeric, (object?)request.EstimatedAmount ?? DBNull.Value);
                    parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
                    parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)request.Notes ?? DBNull.Value);
                },
                MapPlanItem,
                ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            return result is null ? NotFound() : Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating procurement plan item {PlanItemId}.", planItemId);
            return Problem("Internal server error updating procurement plan item.");
        }
    }

    [HttpDelete("api/procurement-plan-items/{planItemId:guid}")]
    public async Task<IActionResult> DeletePlanItem(Guid planItemId, CancellationToken ct)
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
            var results = await ExecuteStoredProcedureAsync(
                conn,
                tx,
                "CALL procurement_workflow.delete_procurement_plan_item_sp(@p_plan_item_id, NULL::refcursor);",
                parameters =>
                {
                    parameters.AddWithValue("p_plan_item_id", NpgsqlDbType.Uuid, planItemId);
                },
                MapPlanItem,
                ct);
            await tx.CommitAsync(ct);

            var result = results.FirstOrDefault();
            return result is null ? NotFound() : Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting procurement plan item {PlanItemId}.", planItemId);
            return Problem("Internal server error deleting procurement plan item.");
        }
    }

    private static async Task<List<T>> ExecuteStoredProcedureAsync<T>(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string commandText,
        Action<NpgsqlParameterCollection> configureParameters,
        Func<NpgsqlDataReader, T> map,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(commandText, conn, tx);
        configureParameters(cmd.Parameters);

        await using var callReader = await cmd.ExecuteReaderAsync(ct);
        if (!await callReader.ReadAsync(ct))
        {
            return new List<T>();
        }

        var cursorName = callReader.GetString(callReader.GetOrdinal("p_result"));
        await callReader.CloseAsync();

        var escapedCursorName = cursorName.Replace("\"", "\"\"");
        await using var fetch = new NpgsqlCommand($"FETCH ALL IN \"{escapedCursorName}\"", conn, tx);
        await using var reader = await fetch.ExecuteReaderAsync(ct);

        var results = new List<T>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(map(reader));
        }

        return results;
    }

    private static ProcurementPlanItemDetail MapPlanItem(NpgsqlDataReader r)
    {
        return new ProcurementPlanItemDetail(
            r.GetGuid(r.GetOrdinal("plan_item_id")),
            r.GetGuid(r.GetOrdinal("plan_id")),
            GetNullableString(r, "item_code"),
            r.GetString(r.GetOrdinal("description")),
            r.GetString(r.GetOrdinal("budget_code")),
            GetNullableString(r, "procurement_type"),
            r.GetFieldValue<decimal>(r.GetOrdinal("estimated_amount")),
            r.GetString(r.GetOrdinal("status")),
            GetNullableString(r, "notes"),
            r.GetDateTime(r.GetOrdinal("created_at")),
            r.GetDateTime(r.GetOrdinal("updated_at")));
    }

    private static string? GetNullableString(NpgsqlDataReader r, string n)
    {
        var ordinal = r.GetOrdinal(n);
        return r.IsDBNull(ordinal) ? null : r.GetString(ordinal);
    }

    private string? ValidateCreateRequest(ProcurementPlanItemCreateRequest request, out string? normalizedStatus, out string? normalizedType)
    {
        normalizedStatus = null;
        normalizedType = null;

        if (string.IsNullOrWhiteSpace(request.Description))
            return "Description is required.";

        if (string.IsNullOrWhiteSpace(request.BudgetCode) || request.BudgetCode.Trim().Length > MaxBudgetCodeLength)
            return $"BudgetCode must be between 1 and {MaxBudgetCodeLength} characters.";

        if (request.EstimatedAmount.HasValue && request.EstimatedAmount.Value < 0)
            return "EstimatedAmount cannot be negative.";

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            normalizedStatus = AllowedStatuses.FirstOrDefault(s => s.Equals(request.Status.Trim(), StringComparison.OrdinalIgnoreCase));
            if (normalizedStatus is null)
                return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
        }

        if (!string.IsNullOrWhiteSpace(request.ProcurementType))
        {
            normalizedType = AllowedProcurementTypes.FirstOrDefault(s => s.Equals(request.ProcurementType.Trim(), StringComparison.OrdinalIgnoreCase));
            if (normalizedType is null)
                return $"ProcurementType must be one of: {string.Join(", ", AllowedProcurementTypes)}.";
        }

        return null;
    }

    private string? ValidateUpdateRequest(ProcurementPlanItemUpdateRequest request, out string? normalizedStatus, out string? normalizedType)
    {
        normalizedStatus = null;
        normalizedType = null;

        var hasAny =
            request.ItemCode is not null ||
            request.Description is not null ||
            request.BudgetCode is not null ||
            request.ProcurementType is not null ||
            request.EstimatedAmount.HasValue ||
            request.Status is not null ||
            request.Notes is not null;

        if (!hasAny)
            return "At least one field is required to update a plan item.";

        if (request.Description is not null && string.IsNullOrWhiteSpace(request.Description))
            return "Description cannot be empty.";

        if (request.BudgetCode is not null && (string.IsNullOrWhiteSpace(request.BudgetCode) || request.BudgetCode.Trim().Length > MaxBudgetCodeLength))
            return $"BudgetCode must be between 1 and {MaxBudgetCodeLength} characters.";

        if (request.EstimatedAmount.HasValue && request.EstimatedAmount.Value < 0)
            return "EstimatedAmount cannot be negative.";

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            normalizedStatus = AllowedStatuses.FirstOrDefault(s => s.Equals(request.Status.Trim(), StringComparison.OrdinalIgnoreCase));
            if (normalizedStatus is null)
                return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
        }

        if (!string.IsNullOrWhiteSpace(request.ProcurementType))
        {
            normalizedType = AllowedProcurementTypes.FirstOrDefault(s => s.Equals(request.ProcurementType.Trim(), StringComparison.OrdinalIgnoreCase));
            if (normalizedType is null)
                return $"ProcurementType must be one of: {string.Join(", ", AllowedProcurementTypes)}.";
        }

        return null;
    }
}

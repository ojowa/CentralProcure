using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using eProcurement.Modules.ProcurementWorkflow.DTOs;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Route("api/bpp-no-objections")]
public class BppNoObjectionsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<BppNoObjectionsController> _logger;

    private static readonly string[] AllowedStatuses = { "Draft", "Submitted", "In Review", "Approved", "Rejected", "Cancelled" };

    public BppNoObjectionsController(IConfiguration config, ILogger<BppNoObjectionsController> logger)
    {
        _config = config;
        _logger = logger;
    }

    private string GetConnectionString() => _config.GetConnectionString("Primary") ?? string.Empty;

    [HttpGet]
    public async Task<IActionResult> GetNoObjections(
        [FromQuery] Guid? requisitionId,
        [FromQuery] Guid? tenderId,
        [FromQuery] string? status,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(status) &&
            !AllowedStatuses.Any(s => s.Equals(status.Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            return BadRequest($"Status must be one of: {string.Join(", ", AllowedStatuses)}.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
SELECT
    no_objection_id,
    requisition_id,
    tender_id,
    amount,
    procurement_type,
    status,
    requested_by,
    requested_at,
    decision_by,
    decision_at,
    decision_notes,
    reference_code,
    created_at,
    updated_at
FROM procurement_workflow.bpp_no_objections
WHERE (@p_requisition_id IS NULL OR requisition_id = @p_requisition_id)
  AND (@p_tender_id IS NULL OR tender_id = @p_tender_id)
  AND (@p_status IS NULL OR status = @p_status)
ORDER BY requested_at DESC;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, (object?)requisitionId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, (object?)tenderId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)status ?? DBNull.Value);

            var results = new List<BppNoObjectionDetail>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                results.Add(MapNoObjection(reader));
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving BPP no objection records.");
            return Problem("Internal server error retrieving no objection records.");
        }
    }

    [HttpGet("{noObjectionId:guid}")]
    public async Task<IActionResult> GetNoObjection(Guid noObjectionId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
SELECT
    no_objection_id,
    requisition_id,
    tender_id,
    amount,
    procurement_type,
    status,
    requested_by,
    requested_at,
    decision_by,
    decision_at,
    decision_notes,
    reference_code,
    created_at,
    updated_at
FROM procurement_workflow.bpp_no_objections
WHERE no_objection_id = @p_no_objection_id;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_no_objection_id", NpgsqlDbType.Uuid, noObjectionId);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return NotFound();
            }

            return Ok(MapNoObjection(reader));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving BPP no objection {NoObjectionId}.", noObjectionId);
            return Problem("Internal server error retrieving no objection record.");
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateNoObjection([FromBody] BppNoObjectionCreateRequest request, CancellationToken ct)
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

        const string sql = @"
INSERT INTO procurement_workflow.bpp_no_objections (
    requisition_id,
    tender_id,
    amount,
    procurement_type,
    status,
    requested_by,
    requested_at,
    reference_code
)
VALUES (
    @p_requisition_id,
    @p_tender_id,
    @p_amount,
    @p_procurement_type,
    COALESCE(@p_status, 'Draft'),
    @p_requested_by,
    COALESCE(@p_requested_at, NOW()),
    @p_reference_code
)
RETURNING no_objection_id, requisition_id, tender_id, amount, procurement_type, status, requested_by, requested_at, decision_by, decision_at, decision_notes, reference_code, created_at, updated_at;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_requisition_id", NpgsqlDbType.Uuid, (object?)request.RequisitionId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, (object?)request.TenderId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_amount", NpgsqlDbType.Numeric, request.Amount);
            cmd.Parameters.AddWithValue("p_procurement_type", NpgsqlDbType.Varchar, (object?)request.ProcurementType ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_requested_by", NpgsqlDbType.Varchar, (object?)request.RequestedBy ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_requested_at", NpgsqlDbType.Timestamp, (object?)request.RequestedAt ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_reference_code", NpgsqlDbType.Varchar, (object?)request.ReferenceCode ?? DBNull.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            await reader.ReadAsync(ct);

            var result = MapNoObjection(reader);
            return Created($"/api/bpp-no-objections/{result.NoObjectionId}", result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating BPP no objection record.");
            return Problem("Internal server error creating no objection record.");
        }
    }

    [HttpPut("{noObjectionId:guid}")]
    public async Task<IActionResult> UpdateNoObjection(Guid noObjectionId, [FromBody] BppNoObjectionUpdateRequest request, CancellationToken ct)
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

        const string sql = @"
UPDATE procurement_workflow.bpp_no_objections
SET
    status = COALESCE(@p_status, status),
    decision_by = COALESCE(@p_decision_by, decision_by),
    decision_at = COALESCE(@p_decision_at, decision_at),
    decision_notes = COALESCE(@p_decision_notes, decision_notes),
    reference_code = COALESCE(@p_reference_code, reference_code),
    updated_at = NOW()
WHERE no_objection_id = @p_no_objection_id
RETURNING no_objection_id, requisition_id, tender_id, amount, procurement_type, status, requested_by, requested_at, decision_by, decision_at, decision_notes, reference_code, created_at, updated_at;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_no_objection_id", NpgsqlDbType.Uuid, noObjectionId);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)normalizedStatus ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_decision_by", NpgsqlDbType.Varchar, (object?)request.DecisionBy ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_decision_at", NpgsqlDbType.Timestamp, (object?)request.DecisionAt ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_decision_notes", NpgsqlDbType.Text, (object?)request.DecisionNotes ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_reference_code", NpgsqlDbType.Varchar, (object?)request.ReferenceCode ?? DBNull.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return NotFound();
            }

            var result = MapNoObjection(reader);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating BPP no objection {NoObjectionId}.", noObjectionId);
            return Problem("Internal server error updating no objection record.");
        }
    }

    private static BppNoObjectionDetail MapNoObjection(NpgsqlDataReader reader)
    {
        return new BppNoObjectionDetail(
            reader.GetGuid(reader.GetOrdinal("no_objection_id")),
            reader.IsDBNull(reader.GetOrdinal("requisition_id")) ? null : reader.GetGuid(reader.GetOrdinal("requisition_id")),
            reader.IsDBNull(reader.GetOrdinal("tender_id")) ? null : reader.GetGuid(reader.GetOrdinal("tender_id")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("amount")),
            reader.IsDBNull(reader.GetOrdinal("procurement_type")) ? null : reader.GetString(reader.GetOrdinal("procurement_type")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.IsDBNull(reader.GetOrdinal("requested_by")) ? null : reader.GetString(reader.GetOrdinal("requested_by")),
            reader.GetDateTime(reader.GetOrdinal("requested_at")),
            reader.IsDBNull(reader.GetOrdinal("decision_by")) ? null : reader.GetString(reader.GetOrdinal("decision_by")),
            reader.IsDBNull(reader.GetOrdinal("decision_at")) ? null : reader.GetDateTime(reader.GetOrdinal("decision_at")),
            reader.IsDBNull(reader.GetOrdinal("decision_notes")) ? null : reader.GetString(reader.GetOrdinal("decision_notes")),
            reader.IsDBNull(reader.GetOrdinal("reference_code")) ? null : reader.GetString(reader.GetOrdinal("reference_code")),
            reader.GetDateTime(reader.GetOrdinal("created_at")),
            reader.GetDateTime(reader.GetOrdinal("updated_at"))
        );
    }

    private string? ValidateCreateRequest(BppNoObjectionCreateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = null;

        if (!request.RequisitionId.HasValue && !request.TenderId.HasValue)
        {
            return "Either RequisitionId or TenderId is required.";
        }

        if (request.Amount <= 0)
        {
            return "Amount must be greater than 0.";
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            normalizedStatus = AllowedStatuses.FirstOrDefault(s => s.Equals(request.Status.Trim(), StringComparison.OrdinalIgnoreCase));
            if (normalizedStatus is null)
            {
                return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
            }
        }

        return null;
    }

    private string? ValidateUpdateRequest(BppNoObjectionUpdateRequest request, out string? normalizedStatus)
    {
        normalizedStatus = null;

        var hasAny =
            request.Status is not null ||
            request.DecisionBy is not null ||
            request.DecisionAt.HasValue ||
            request.DecisionNotes is not null ||
            request.ReferenceCode is not null;

        if (!hasAny)
        {
            return "At least one field is required to update a no objection record.";
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            normalizedStatus = AllowedStatuses.FirstOrDefault(s => s.Equals(request.Status.Trim(), StringComparison.OrdinalIgnoreCase));
            if (normalizedStatus is null)
            {
                return $"Status must be one of: {string.Join(", ", AllowedStatuses)}.";
            }
        }

        return null;
    }
}

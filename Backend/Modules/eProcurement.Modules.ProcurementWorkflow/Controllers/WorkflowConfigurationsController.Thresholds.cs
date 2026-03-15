using eProcurement.Modules.ProcurementWorkflow.DTOs;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class WorkflowConfigurationsController
{
    [HttpPost("thresholds")]
    public async Task<IActionResult> CreateThreshold([FromBody] WorkflowThresholdCreateRequest request, CancellationToken ct)
    {
        var validationError = ValidateThresholdCreateRequest(request);
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
INSERT INTO procurement_workflow.approval_thresholds (
    procurement_type,
    min_amount,
    max_amount,
    approval_route,
    approval_authority_code,
    approval_authority_label,
    requires_cgis_approval,
    requires_board,
    requires_bpp,
    governance_body_id,
    status,
    notes,
    updated_at
)
VALUES (
    @p_procurement_type,
    @p_min_amount,
    @p_max_amount,
    @p_approval_route,
    @p_approval_authority_code,
    @p_approval_authority_label,
    @p_requires_cgis_approval,
    @p_requires_board,
    @p_requires_bpp,
    @p_governance_body_id,
    @p_status,
    @p_notes,
    NOW()
)
RETURNING
    threshold_id,
    procurement_type,
    min_amount,
    max_amount,
    approval_route,
    approval_authority_code,
    approval_authority_label,
    requires_cgis_approval,
    requires_board,
    requires_bpp,
    governance_body_id,
    (SELECT body_name FROM procurement_workflow.governance_bodies WHERE body_id = governance_body_id) AS governance_body_name,
    status,
    notes,
    updated_at;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            AddThresholdCommandParameters(
                cmd,
                request.ProcurementType,
                request.MinAmount,
                request.MaxAmount,
                request.ApprovalRoute,
                request.ApprovalAuthorityCode,
                request.ApprovalAuthorityLabel,
                request.RequiresCgisApproval,
                request.RequiresBoard,
                request.RequiresBpp,
                request.GovernanceBodyId,
                NormalizeThresholdStatus(request.Status) ?? "Active",
                request.Notes);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                return Created($"/api/config/workflows/thresholds/{reader.GetGuid(reader.GetOrdinal("threshold_id"))}", MapThreshold(reader));
            }

            return Problem("Threshold creation failed.");
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error creating workflow threshold.");
            return Problem("Internal server error creating workflow threshold.");
        }
    }

    [HttpPut("thresholds/{thresholdId:guid}")]
    public async Task<IActionResult> UpdateThreshold(Guid thresholdId, [FromBody] WorkflowThresholdUpdateRequest request, CancellationToken ct)
    {
        var validationError = ValidateThresholdUpdateRequest(request);
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
UPDATE procurement_workflow.approval_thresholds
SET procurement_type = COALESCE(@p_procurement_type, procurement_type),
    min_amount = COALESCE(@p_min_amount, min_amount),
    max_amount = COALESCE(@p_max_amount, max_amount),
    approval_route = COALESCE(@p_approval_route, approval_route),
    approval_authority_code = COALESCE(@p_approval_authority_code, approval_authority_code),
    approval_authority_label = COALESCE(@p_approval_authority_label, approval_authority_label),
    requires_cgis_approval = COALESCE(@p_requires_cgis_approval, requires_cgis_approval),
    requires_board = COALESCE(@p_requires_board, requires_board),
    requires_bpp = COALESCE(@p_requires_bpp, requires_bpp),
    governance_body_id = CASE
        WHEN @p_clear_governance_body THEN NULL
        ELSE COALESCE(@p_governance_body_id, governance_body_id)
    END,
    status = COALESCE(@p_status, status),
    notes = COALESCE(@p_notes, notes),
    updated_at = NOW()
WHERE threshold_id = @p_threshold_id
RETURNING
    threshold_id,
    procurement_type,
    min_amount,
    max_amount,
    approval_route,
    approval_authority_code,
    approval_authority_label,
    requires_cgis_approval,
    requires_board,
    requires_bpp,
    governance_body_id,
    (SELECT body_name FROM procurement_workflow.governance_bodies WHERE body_id = governance_body_id) AS governance_body_name,
    status,
    notes,
    updated_at;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_threshold_id", NpgsqlDbType.Uuid, thresholdId);
            cmd.Parameters.AddWithValue("p_procurement_type", NpgsqlDbType.Varchar, (object?)NullIfWhitespace(request.ProcurementType) ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_min_amount", NpgsqlDbType.Numeric, (object?)request.MinAmount ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_max_amount", NpgsqlDbType.Numeric, (object?)request.MaxAmount ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_approval_route", NpgsqlDbType.Varchar, (object?)NullIfWhitespace(request.ApprovalRoute) ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_approval_authority_code", NpgsqlDbType.Varchar, (object?)NullIfWhitespace(request.ApprovalAuthorityCode) ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_approval_authority_label", NpgsqlDbType.Varchar, (object?)NullIfWhitespace(request.ApprovalAuthorityLabel) ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_requires_cgis_approval", NpgsqlDbType.Boolean, (object?)request.RequiresCgisApproval ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_requires_board", NpgsqlDbType.Boolean, (object?)request.RequiresBoard ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_requires_bpp", NpgsqlDbType.Boolean, (object?)request.RequiresBpp ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_governance_body_id", NpgsqlDbType.Uuid, (object?)request.GovernanceBodyId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_clear_governance_body", NpgsqlDbType.Boolean, request.GovernanceBodyId == Guid.Empty);
            cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, (object?)NormalizeThresholdStatus(request.Status) ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)request.Notes ?? DBNull.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                return Ok(MapThreshold(reader));
            }

            return NotFound();
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error updating workflow threshold {ThresholdId}.", thresholdId);
            return Problem("Internal server error updating workflow threshold.");
        }
    }

    [HttpDelete("thresholds/{thresholdId:guid}")]
    public async Task<IActionResult> DeleteThreshold(Guid thresholdId, CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = "DELETE FROM procurement_workflow.approval_thresholds WHERE threshold_id = @p_threshold_id;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_threshold_id", NpgsqlDbType.Uuid, thresholdId);
            var rows = await cmd.ExecuteNonQueryAsync(ct);
            return rows > 0 ? NoContent() : NotFound();
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error deleting workflow threshold {ThresholdId}.", thresholdId);
            return Problem("Internal server error deleting workflow threshold.");
        }
    }

    private static string? ValidateThresholdCreateRequest(WorkflowThresholdCreateRequest request)
    {
        if (request.MinAmount < 0)
        {
            return "MinAmount must be 0 or greater.";
        }

        if (request.MaxAmount.HasValue && request.MaxAmount.Value < request.MinAmount)
        {
            return "MaxAmount must be greater than or equal to MinAmount.";
        }

        if (string.IsNullOrWhiteSpace(request.ApprovalRoute))
        {
            return "ApprovalRoute is required.";
        }

        if (string.IsNullOrWhiteSpace(request.ApprovalAuthorityCode))
        {
            return "ApprovalAuthorityCode is required.";
        }

        if (string.IsNullOrWhiteSpace(request.ApprovalAuthorityLabel))
        {
            return "ApprovalAuthorityLabel is required.";
        }

        if (request.RequiresCgisApproval && request.RequiresBoard)
        {
            return "A threshold cannot require both CGIS direct approval and Tenders Board review.";
        }

        if (request.RequiresBoard && (!request.GovernanceBodyId.HasValue || request.GovernanceBodyId == Guid.Empty))
        {
            return "GovernanceBodyId is required when RequiresBoard is true.";
        }

        if (!string.IsNullOrWhiteSpace(request.Status) && NormalizeThresholdStatus(request.Status) is null)
        {
            return $"Status must be one of: {string.Join(", ", AllowedThresholdStatuses)}.";
        }

        return null;
    }

    private static string? ValidateThresholdUpdateRequest(WorkflowThresholdUpdateRequest request)
    {
        var hasAnyField =
            request.ProcurementType is not null ||
            request.MinAmount.HasValue ||
            request.MaxAmount.HasValue ||
            request.ApprovalRoute is not null ||
            request.ApprovalAuthorityCode is not null ||
            request.ApprovalAuthorityLabel is not null ||
            request.RequiresCgisApproval.HasValue ||
            request.RequiresBoard.HasValue ||
            request.RequiresBpp.HasValue ||
            request.GovernanceBodyId.HasValue ||
            request.Status is not null ||
            request.Notes is not null;

        if (!hasAnyField)
        {
            return "At least one field is required to update a threshold.";
        }

        if (request.MinAmount.HasValue && request.MinAmount.Value < 0)
        {
            return "MinAmount must be 0 or greater.";
        }

        if (request.MinAmount.HasValue && request.MaxAmount.HasValue && request.MaxAmount.Value < request.MinAmount.Value)
        {
            return "MaxAmount must be greater than or equal to MinAmount.";
        }

        if (request.RequiresCgisApproval == true && request.RequiresBoard == true)
        {
            return "A threshold cannot require both CGIS direct approval and Tenders Board review.";
        }

        if (request.RequiresBoard == true && request.GovernanceBodyId == Guid.Empty)
        {
            return "GovernanceBodyId is required when RequiresBoard is true.";
        }

        if (!string.IsNullOrWhiteSpace(request.Status) && NormalizeThresholdStatus(request.Status) is null)
        {
            return $"Status must be one of: {string.Join(", ", AllowedThresholdStatuses)}.";
        }

        return null;
    }

    private static void AddThresholdCommandParameters(
        NpgsqlCommand cmd,
        string? procurementType,
        decimal minAmount,
        decimal? maxAmount,
        string approvalRoute,
        string approvalAuthorityCode,
        string approvalAuthorityLabel,
        bool requiresCgisApproval,
        bool requiresBoard,
        bool requiresBpp,
        Guid? governanceBodyId,
        string status,
        string? notes)
    {
        cmd.Parameters.AddWithValue("p_procurement_type", NpgsqlDbType.Varchar, (object?)NullIfWhitespace(procurementType) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_min_amount", NpgsqlDbType.Numeric, minAmount);
        cmd.Parameters.AddWithValue("p_max_amount", NpgsqlDbType.Numeric, (object?)maxAmount ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_approval_route", NpgsqlDbType.Varchar, approvalRoute.Trim());
        cmd.Parameters.AddWithValue("p_approval_authority_code", NpgsqlDbType.Varchar, approvalAuthorityCode.Trim());
        cmd.Parameters.AddWithValue("p_approval_authority_label", NpgsqlDbType.Varchar, approvalAuthorityLabel.Trim());
        cmd.Parameters.AddWithValue("p_requires_cgis_approval", NpgsqlDbType.Boolean, requiresCgisApproval);
        cmd.Parameters.AddWithValue("p_requires_board", NpgsqlDbType.Boolean, requiresBoard);
        cmd.Parameters.AddWithValue("p_requires_bpp", NpgsqlDbType.Boolean, requiresBpp);
        cmd.Parameters.AddWithValue("p_governance_body_id", NpgsqlDbType.Uuid, (object?)governanceBodyId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, status);
        cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)notes ?? DBNull.Value);
    }
}

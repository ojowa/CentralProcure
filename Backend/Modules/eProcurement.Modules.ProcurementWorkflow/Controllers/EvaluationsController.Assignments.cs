using Npgsql;
using NpgsqlTypes;
using Microsoft.AspNetCore.Mvc;
using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Modules.ProcurementWorkflow.Services;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class EvaluationsController
{
    [HttpGet("assignments")]
    public async Task<IActionResult> GetTenderAssignments([FromQuery] Guid? tenderId, CancellationToken ct)
    {
        if (!CanManageAssignments())
        {
            return Forbid();
        }

        var connectionString = _config.GetConnectionString("Primary");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = """
SELECT
    t.tender_id,
    t.title AS tender_title,
    t.status AS tender_status,
    roles.assignment_role,
    tea.internal_user_id,
    iu.email,
    iu.username,
    r.role_name,
    ou.unit_name,
    tea.assigned_by,
    tea.assigned_at
FROM vendor_sourcing.tenders t
CROSS JOIN (
    SELECT unnest(ARRAY['technical_evaluator','financial_evaluator','evaluation_committee']) AS assignment_role
) roles
LEFT JOIN procurement_workflow.tender_evaluation_assignments tea
  ON tea.tender_id = t.tender_id
 AND tea.assignment_role = roles.assignment_role
LEFT JOIN identity.internal_users iu
  ON iu.internal_user_id = tea.internal_user_id
LEFT JOIN identity.roles r
  ON r.role_id = iu.role_id
LEFT JOIN identity.organizational_units ou
  ON ou.unit_id = iu.unit_id
WHERE (@p_tender_id IS NULL OR t.tender_id = @p_tender_id)
ORDER BY t.created_at DESC, roles.assignment_role;
""";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await TenderEvaluationAssignmentRegistry.EnsureTableAsync(conn, null, ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, (object?)tenderId ?? DBNull.Value);
            await using var reader = await cmd.ExecuteReaderAsync(ct);

            var items = new List<TenderEvaluationAssignmentItem>();
            while (await reader.ReadAsync(ct))
            {
                items.Add(new TenderEvaluationAssignmentItem(
                    reader.GetGuid(reader.GetOrdinal("tender_id")),
                    reader.GetString(reader.GetOrdinal("tender_title")),
                    reader.GetString(reader.GetOrdinal("tender_status")),
                    reader.GetString(reader.GetOrdinal("assignment_role")),
                    reader.IsDBNull(reader.GetOrdinal("internal_user_id")) ? null : reader.GetGuid(reader.GetOrdinal("internal_user_id")),
                    reader.IsDBNull(reader.GetOrdinal("email")) ? null : reader.GetString(reader.GetOrdinal("email")),
                    reader.IsDBNull(reader.GetOrdinal("username")) ? null : reader.GetString(reader.GetOrdinal("username")),
                    reader.IsDBNull(reader.GetOrdinal("role_name")) ? null : reader.GetString(reader.GetOrdinal("role_name")),
                    reader.IsDBNull(reader.GetOrdinal("unit_name")) ? null : reader.GetString(reader.GetOrdinal("unit_name")),
                    reader.IsDBNull(reader.GetOrdinal("assigned_by")) ? null : reader.GetString(reader.GetOrdinal("assigned_by")),
                    reader.IsDBNull(reader.GetOrdinal("assigned_at")) ? null : reader.GetDateTime(reader.GetOrdinal("assigned_at"))));
            }

            return Ok(items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving tender evaluation assignments.");
            return Problem("Internal server error retrieving tender evaluation assignments.");
        }
    }

    [HttpPut("assignments/{tenderId:guid}")]
    public async Task<IActionResult> UpsertTenderAssignment(Guid tenderId, [FromBody] TenderEvaluationAssignmentUpdateRequest request, CancellationToken ct)
    {
        if (!CanManageAssignments())
        {
            return Forbid();
        }

        var normalizedRole = request.AssignmentRole?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedRole) || !TenderEvaluationAssignmentRegistry.Roles.Contains(normalizedRole, StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest("AssignmentRole must be one of: technical_evaluator, financial_evaluator, evaluation_committee.");
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
            await TenderEvaluationAssignmentRegistry.EnsureTableAsync(conn, tx, ct);

            if (request.InternalUserId.HasValue)
            {
                const string userSql = """
SELECT EXISTS (
    SELECT 1
    FROM identity.internal_users
    WHERE internal_user_id = @p_internal_user_id
      AND is_active = TRUE
);
""";
                await using var userCmd = new NpgsqlCommand(userSql, conn, tx);
                userCmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, request.InternalUserId.Value);
                if (await userCmd.ExecuteScalarAsync(ct) is not bool exists || !exists)
                {
                    return BadRequest("Assigned user must be an active internal user.");
                }
            }

            const string deleteSql = """
DELETE FROM procurement_workflow.tender_evaluation_assignments
WHERE tender_id = @p_tender_id
  AND assignment_role = @p_assignment_role;
""";
            await using (var deleteCmd = new NpgsqlCommand(deleteSql, conn, tx))
            {
                deleteCmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);
                deleteCmd.Parameters.AddWithValue("p_assignment_role", NpgsqlDbType.Varchar, normalizedRole);
                await deleteCmd.ExecuteNonQueryAsync(ct);
            }

            if (request.InternalUserId.HasValue)
            {
                const string insertSql = """
INSERT INTO procurement_workflow.tender_evaluation_assignments (
    tender_id, assignment_role, internal_user_id, assigned_by, assigned_at, created_at, updated_at
)
VALUES (
    @p_tender_id, @p_assignment_role, @p_internal_user_id, @p_assigned_by, NOW(), NOW(), NOW()
);
""";
                await using var insertCmd = new NpgsqlCommand(insertSql, conn, tx);
                insertCmd.Parameters.AddWithValue("p_tender_id", NpgsqlDbType.Uuid, tenderId);
                insertCmd.Parameters.AddWithValue("p_assignment_role", NpgsqlDbType.Varchar, normalizedRole);
                insertCmd.Parameters.AddWithValue("p_internal_user_id", NpgsqlDbType.Uuid, request.InternalUserId.Value);
                insertCmd.Parameters.AddWithValue("p_assigned_by", NpgsqlDbType.Varchar, ResolveActor() ?? string.Empty);
                await insertCmd.ExecuteNonQueryAsync(ct);
                await TenderEvaluationAssignmentRegistry.EnsureModuleGrantAsync(conn, tx, request.InternalUserId.Value, ResolveInternalUserId(), ct);
            }

            await tx.CommitAsync(ct);
            return Ok(new { tenderId, assignmentRole = normalizedRole, internalUserId = request.InternalUserId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating tender evaluation assignment for tender {TenderId}.", tenderId);
            return Problem("Internal server error updating tender evaluation assignment.");
        }
    }

    private bool CanManageAssignments()
    {
        var roleKey = WorkflowActionGrantService.ResolveRoleKey(User);
        return string.Equals(roleKey, "admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(roleKey, "comptroller_procurement", StringComparison.OrdinalIgnoreCase)
            || string.Equals(roleKey, "procurement_manager", StringComparison.OrdinalIgnoreCase);
    }
}

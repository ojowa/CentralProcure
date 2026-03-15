using eProcurement.Modules.ProcurementWorkflow.DTOs;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class WorkflowConfigurationsController
{
    [HttpPut("stages/{stageKey}")]
    public async Task<IActionResult> UpdateStage(string stageKey, [FromBody] WorkflowStageUpdateRequest request, CancellationToken ct)
    {
        if (request is null)
        {
            return BadRequest("Request body is required.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
UPDATE procurement_workflow.workflow_stage_catalog
SET phase_key = COALESCE(@p_phase_key, phase_key),
    stage_title = COALESCE(@p_stage_title, stage_title),
    stage_description = COALESCE(@p_stage_description, stage_description),
    sequence_no = COALESCE(@p_sequence_no, sequence_no),
    is_decision_gate = COALESCE(@p_is_decision_gate, is_decision_gate),
    is_start = COALESCE(@p_is_start, is_start),
    is_terminal = COALESCE(@p_is_terminal, is_terminal),
    primary_owner_role = COALESCE(@p_primary_owner_role, primary_owner_role),
    ppa_reference = COALESCE(@p_ppa_reference, ppa_reference),
    updated_at = NOW()
WHERE stage_key = @p_stage_key
RETURNING stage_key, phase_key, stage_title, stage_description, sequence_no, is_decision_gate, is_start, is_terminal, primary_owner_role, ppa_reference, updated_at;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_stage_key", NpgsqlDbType.Varchar, stageKey);
            cmd.Parameters.AddWithValue("p_phase_key", NpgsqlDbType.Varchar, (object?)NullIfWhitespace(request.PhaseKey) ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_stage_title", NpgsqlDbType.Varchar, (object?)NullIfWhitespace(request.StageTitle) ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_stage_description", NpgsqlDbType.Text, (object?)NullIfWhitespace(request.StageDescription) ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_sequence_no", NpgsqlDbType.Integer, (object?)request.SequenceNo ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_is_decision_gate", NpgsqlDbType.Boolean, (object?)request.IsDecisionGate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_is_start", NpgsqlDbType.Boolean, (object?)request.IsStart ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_is_terminal", NpgsqlDbType.Boolean, (object?)request.IsTerminal ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_primary_owner_role", NpgsqlDbType.Varchar, (object?)NullIfWhitespace(request.PrimaryOwnerRole) ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_ppa_reference", NpgsqlDbType.Varchar, (object?)NullIfWhitespace(request.PpaReference) ?? DBNull.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                return Ok(MapStage(reader));
            }

            return NotFound();
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error updating workflow stage {StageKey}.", stageKey);
            return Problem("Internal server error updating workflow stage.");
        }
    }

    [HttpPost("transitions")]
    public async Task<IActionResult> CreateTransition([FromBody] WorkflowTransitionCreateRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.FromStageKey) || string.IsNullOrWhiteSpace(request.ToStageKey) || string.IsNullOrWhiteSpace(request.TransitionCondition))
        {
            return BadRequest("FromStageKey, ToStageKey, and TransitionCondition are required.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
INSERT INTO procurement_workflow.workflow_stage_transitions (
    from_stage_key,
    to_stage_key,
    transition_condition
)
VALUES (@p_from_stage_key, @p_to_stage_key, @p_transition_condition)
RETURNING transition_id, from_stage_key, to_stage_key, transition_condition, created_at;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_from_stage_key", NpgsqlDbType.Varchar, request.FromStageKey.Trim());
            cmd.Parameters.AddWithValue("p_to_stage_key", NpgsqlDbType.Varchar, request.ToStageKey.Trim());
            cmd.Parameters.AddWithValue("p_transition_condition", NpgsqlDbType.Text, request.TransitionCondition.Trim());

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                return Created("/api/config/workflows/transitions", MapTransition(reader));
            }

            return Problem("Transition creation failed.");
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error creating workflow transition.");
            return Problem("Internal server error creating workflow transition.");
        }
    }

    [HttpDelete("transitions/{transitionId:guid}")]
    public async Task<IActionResult> DeleteTransition(Guid transitionId, CancellationToken ct)
    {
        return await DeleteByIdAsync(
            "DELETE FROM procurement_workflow.workflow_stage_transitions WHERE transition_id = @p_id;",
            transitionId,
            "Error deleting workflow transition {EntityId}.",
            "Internal server error deleting workflow transition.",
            ct);
    }

    [HttpPost("role-tasks")]
    public async Task<IActionResult> CreateRoleTask([FromBody] WorkflowRoleTaskCreateRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.RoleKey) ||
            string.IsNullOrWhiteSpace(request.DisplayName) ||
            string.IsNullOrWhiteSpace(request.StageKey) ||
            string.IsNullOrWhiteSpace(request.TaskDescription) ||
            string.IsNullOrWhiteSpace(request.ExpectedOutcome))
        {
            return BadRequest("RoleKey, DisplayName, StageKey, TaskDescription, and ExpectedOutcome are required.");
        }

        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Problem("Connection string 'Primary' is not configured.", statusCode: 500);
        }

        const string sql = @"
INSERT INTO procurement_workflow.workflow_role_tasks (
    role_key,
    display_name,
    stage_key,
    task_description,
    expected_outcome
)
VALUES (@p_role_key, @p_display_name, @p_stage_key, @p_task_description, @p_expected_outcome)
RETURNING role_task_id, role_key, display_name, stage_key, task_description, expected_outcome, created_at;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_role_key", NpgsqlDbType.Varchar, request.RoleKey.Trim());
            cmd.Parameters.AddWithValue("p_display_name", NpgsqlDbType.Varchar, request.DisplayName.Trim());
            cmd.Parameters.AddWithValue("p_stage_key", NpgsqlDbType.Varchar, request.StageKey.Trim());
            cmd.Parameters.AddWithValue("p_task_description", NpgsqlDbType.Text, request.TaskDescription.Trim());
            cmd.Parameters.AddWithValue("p_expected_outcome", NpgsqlDbType.Text, request.ExpectedOutcome.Trim());

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                return Created("/api/config/workflows/role-tasks", MapRoleTask(reader));
            }

            return Problem("Role task creation failed.");
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error creating workflow role task.");
            return Problem("Internal server error creating workflow role task.");
        }
    }

    [HttpDelete("role-tasks/{roleTaskId:guid}")]
    public async Task<IActionResult> DeleteRoleTask(Guid roleTaskId, CancellationToken ct)
    {
        return await DeleteByIdAsync(
            "DELETE FROM procurement_workflow.workflow_role_tasks WHERE role_task_id = @p_id;",
            roleTaskId,
            "Error deleting workflow role task {EntityId}.",
            "Internal server error deleting workflow role task.",
            ct);
    }

    private async Task<IActionResult> DeleteByIdAsync(string sql, Guid id, string logTemplate, string problemMessage, CancellationToken ct)
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
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("p_id", NpgsqlDbType.Uuid, id);
            var rows = await cmd.ExecuteNonQueryAsync(ct);
            return rows > 0 ? NoContent() : NotFound();
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, logTemplate, id);
            return Problem(problemMessage);
        }
    }
}

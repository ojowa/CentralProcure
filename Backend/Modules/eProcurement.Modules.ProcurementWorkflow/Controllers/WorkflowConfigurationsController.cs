using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Modules.ProcurementWorkflow.Services;
using eProcurement.Shared.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

[ApiController]
[Authorize]
[Route("api/config/workflows")]
public class WorkflowConfigurationsController : BaseModuleController
{
    private static readonly string[] AllowedThresholdStatuses = { "Active", "Inactive" };

    public WorkflowConfigurationsController(IConfiguration config, ILogger<WorkflowConfigurationsController> logger)
        : base(config, logger)
    {
    }

    [HttpGet]
    public async Task<IActionResult> GetConfiguration(CancellationToken ct)
    {
        var connectionString = GetConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Ok(BuildFallbackConfiguration());
        }

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);

            var stages = await GetStagesAsync(conn, ct);
            var transitions = await GetTransitionsAsync(conn, ct);
            var roleTasks = await GetRoleTasksAsync(conn, ct);
            var thresholds = await GetThresholdsAsync(conn, ct);
            var roles = await GetRolesAsync(conn, ct);

            return Ok(new WorkflowConfigurationResult(
                "Workflow Configuration Console",
                "Configure threshold routing, workflow stages, transitions, and role responsibilities from one admin workspace.",
                stages.Count > 0 ? stages : BuildFallbackConfiguration().Stages,
                transitions.Count > 0 ? transitions : BuildFallbackConfiguration().Transitions,
                roleTasks.Count > 0 ? roleTasks : BuildFallbackConfiguration().RoleTasks,
                thresholds,
                roles));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error retrieving workflow configuration.");
            return Problem("Internal server error retrieving workflow configuration.");
        }
    }

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
    requires_board,
    requires_bpp,
    status,
    notes,
    updated_at
)
VALUES (
    @p_procurement_type,
    @p_min_amount,
    @p_max_amount,
    @p_approval_route,
    @p_requires_board,
    @p_requires_bpp,
    @p_status,
    @p_notes,
    NOW()
)
RETURNING threshold_id, procurement_type, min_amount, max_amount, approval_route, requires_board, requires_bpp, status, notes, updated_at;";

        try
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            AddThresholdCommandParameters(cmd, request.ProcurementType, request.MinAmount, request.MaxAmount, request.ApprovalRoute, request.RequiresBoard, request.RequiresBpp, NormalizeThresholdStatus(request.Status) ?? "Active", request.Notes);

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
    requires_board = COALESCE(@p_requires_board, requires_board),
    requires_bpp = COALESCE(@p_requires_bpp, requires_bpp),
    status = COALESCE(@p_status, status),
    notes = COALESCE(@p_notes, notes),
    updated_at = NOW()
WHERE threshold_id = @p_threshold_id
RETURNING threshold_id, procurement_type, min_amount, max_amount, approval_route, requires_board, requires_bpp, status, notes, updated_at;";

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
            cmd.Parameters.AddWithValue("p_requires_board", NpgsqlDbType.Boolean, (object?)request.RequiresBoard ?? DBNull.Value);
            cmd.Parameters.AddWithValue("p_requires_bpp", NpgsqlDbType.Boolean, (object?)request.RequiresBpp ?? DBNull.Value);
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

    private async Task<List<WorkflowConfigurationStageResult>> GetStagesAsync(NpgsqlConnection conn, CancellationToken ct)
    {
        const string sql = @"
SELECT
    stage_key,
    phase_key,
    stage_title,
    stage_description,
    sequence_no,
    is_decision_gate,
    is_start,
    is_terminal,
    primary_owner_role,
    ppa_reference,
    updated_at
FROM procurement_workflow.workflow_stage_catalog
ORDER BY sequence_no ASC;";

        var results = new List<WorkflowConfigurationStageResult>();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(MapStage(reader));
        }

        return results;
    }

    private async Task<List<WorkflowConfigurationTransitionResult>> GetTransitionsAsync(NpgsqlConnection conn, CancellationToken ct)
    {
        const string sql = @"
SELECT
    transition_id,
    from_stage_key,
    to_stage_key,
    transition_condition,
    created_at
FROM procurement_workflow.workflow_stage_transitions
ORDER BY created_at ASC;";

        var results = new List<WorkflowConfigurationTransitionResult>();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(MapTransition(reader));
        }

        return results;
    }

    private async Task<List<WorkflowConfigurationRoleTaskResult>> GetRoleTasksAsync(NpgsqlConnection conn, CancellationToken ct)
    {
        const string sql = @"
SELECT
    role_task_id,
    role_key,
    display_name,
    stage_key,
    task_description,
    expected_outcome,
    created_at
FROM procurement_workflow.workflow_role_tasks
ORDER BY role_key ASC, stage_key ASC, created_at ASC;";

        var results = new List<WorkflowConfigurationRoleTaskResult>();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(MapRoleTask(reader));
        }

        return results;
    }

    private async Task<List<WorkflowConfigurationThresholdResult>> GetThresholdsAsync(NpgsqlConnection conn, CancellationToken ct)
    {
        const string sql = @"
SELECT
    threshold_id,
    procurement_type,
    min_amount,
    max_amount,
    approval_route,
    requires_board,
    requires_bpp,
    status,
    notes,
    updated_at
FROM procurement_workflow.approval_thresholds
ORDER BY procurement_type NULLS FIRST, min_amount ASC;";

        var results = new List<WorkflowConfigurationThresholdResult>();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(MapThreshold(reader));
        }

        return results;
    }

    private async Task<List<WorkflowConfigurationRoleResult>> GetRolesAsync(NpgsqlConnection conn, CancellationToken ct)
    {
        const string sql = @"
SELECT role_name, description, is_active
FROM identity.roles
ORDER BY role_name ASC;";

        var results = new List<WorkflowConfigurationRoleResult>();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(new WorkflowConfigurationRoleResult(
                reader.GetString(reader.GetOrdinal("role_name")),
                reader.IsDBNull(reader.GetOrdinal("description")) ? null : reader.GetString(reader.GetOrdinal("description")),
                reader.GetBoolean(reader.GetOrdinal("is_active"))));
        }

        return results;
    }

    private static WorkflowConfigurationResult BuildFallbackConfiguration()
    {
        var stages = WorkflowBlueprintCatalog.GetStates()
            .Select(state => new WorkflowConfigurationStageResult(
                state.Id,
                state.PhaseId,
                state.Title,
                state.Description,
                state.Sequence,
                state.IsDecisionGate,
                state.IsStart,
                state.IsTerminal,
                state.PrimaryOwners.FirstOrDefault() ?? "procurement_officer",
                state.PpaReference,
                null))
            .ToArray();

        var transitions = WorkflowBlueprintCatalog.GetTransitions()
            .Select((transition, index) => new WorkflowConfigurationTransitionResult(
                DeterministicGuid($"transition:{index}:{transition.FromStateId}:{transition.ToStateId}:{transition.Condition}"),
                transition.FromStateId,
                transition.ToStateId,
                transition.Condition,
                null))
            .ToArray();

        var roleTasks = WorkflowBlueprintCatalog.GetRoleTasks()
            .Select((task, index) => new WorkflowConfigurationRoleTaskResult(
                DeterministicGuid($"role-task:{index}:{task.Role}:{task.StateId}:{task.Task}"),
                task.Role,
                task.DisplayName,
                task.StateId,
                task.Task,
                task.ExpectedOutcome,
                null))
            .ToArray();

        return new WorkflowConfigurationResult(
            "Workflow Configuration Console",
            "Configure threshold routing, workflow stages, transitions, and role responsibilities from one admin workspace.",
            stages,
            transitions,
            roleTasks,
            [],
            []);
    }

    private static WorkflowConfigurationStageResult MapStage(NpgsqlDataReader reader) =>
        new(
            reader.GetString(reader.GetOrdinal("stage_key")),
            reader.GetString(reader.GetOrdinal("phase_key")),
            reader.GetString(reader.GetOrdinal("stage_title")),
            reader.GetString(reader.GetOrdinal("stage_description")),
            reader.GetInt32(reader.GetOrdinal("sequence_no")),
            reader.GetBoolean(reader.GetOrdinal("is_decision_gate")),
            reader.GetBoolean(reader.GetOrdinal("is_start")),
            reader.GetBoolean(reader.GetOrdinal("is_terminal")),
            reader.GetString(reader.GetOrdinal("primary_owner_role")),
            reader.IsDBNull(reader.GetOrdinal("ppa_reference")) ? null : reader.GetString(reader.GetOrdinal("ppa_reference")),
            reader.IsDBNull(reader.GetOrdinal("updated_at")) ? null : reader.GetDateTime(reader.GetOrdinal("updated_at")));

    private static WorkflowConfigurationTransitionResult MapTransition(NpgsqlDataReader reader) =>
        new(
            reader.GetGuid(reader.GetOrdinal("transition_id")),
            reader.GetString(reader.GetOrdinal("from_stage_key")),
            reader.GetString(reader.GetOrdinal("to_stage_key")),
            reader.GetString(reader.GetOrdinal("transition_condition")),
            reader.IsDBNull(reader.GetOrdinal("created_at")) ? null : reader.GetDateTime(reader.GetOrdinal("created_at")));

    private static WorkflowConfigurationRoleTaskResult MapRoleTask(NpgsqlDataReader reader) =>
        new(
            reader.GetGuid(reader.GetOrdinal("role_task_id")),
            reader.GetString(reader.GetOrdinal("role_key")),
            reader.GetString(reader.GetOrdinal("display_name")),
            reader.GetString(reader.GetOrdinal("stage_key")),
            reader.GetString(reader.GetOrdinal("task_description")),
            reader.GetString(reader.GetOrdinal("expected_outcome")),
            reader.IsDBNull(reader.GetOrdinal("created_at")) ? null : reader.GetDateTime(reader.GetOrdinal("created_at")));

    private static WorkflowConfigurationThresholdResult MapThreshold(NpgsqlDataReader reader) =>
        new(
            reader.GetGuid(reader.GetOrdinal("threshold_id")),
            reader.IsDBNull(reader.GetOrdinal("procurement_type")) ? null : reader.GetString(reader.GetOrdinal("procurement_type")),
            reader.GetDecimal(reader.GetOrdinal("min_amount")),
            reader.IsDBNull(reader.GetOrdinal("max_amount")) ? null : reader.GetDecimal(reader.GetOrdinal("max_amount")),
            reader.GetString(reader.GetOrdinal("approval_route")),
            reader.GetBoolean(reader.GetOrdinal("requires_board")),
            reader.GetBoolean(reader.GetOrdinal("requires_bpp")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.IsDBNull(reader.GetOrdinal("notes")) ? null : reader.GetString(reader.GetOrdinal("notes")),
            reader.IsDBNull(reader.GetOrdinal("updated_at")) ? null : reader.GetDateTime(reader.GetOrdinal("updated_at")));

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
            request.RequiresBoard.HasValue ||
            request.RequiresBpp.HasValue ||
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
        bool requiresBoard,
        bool requiresBpp,
        string status,
        string? notes)
    {
        cmd.Parameters.AddWithValue("p_procurement_type", NpgsqlDbType.Varchar, (object?)NullIfWhitespace(procurementType) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_min_amount", NpgsqlDbType.Numeric, minAmount);
        cmd.Parameters.AddWithValue("p_max_amount", NpgsqlDbType.Numeric, (object?)maxAmount ?? DBNull.Value);
        cmd.Parameters.AddWithValue("p_approval_route", NpgsqlDbType.Varchar, approvalRoute.Trim());
        cmd.Parameters.AddWithValue("p_requires_board", NpgsqlDbType.Boolean, requiresBoard);
        cmd.Parameters.AddWithValue("p_requires_bpp", NpgsqlDbType.Boolean, requiresBpp);
        cmd.Parameters.AddWithValue("p_status", NpgsqlDbType.Varchar, status);
        cmd.Parameters.AddWithValue("p_notes", NpgsqlDbType.Text, (object?)notes ?? DBNull.Value);
    }

    private static string? NormalizeThresholdStatus(string? status) =>
        AllowedThresholdStatuses.FirstOrDefault(s => s.Equals(status?.Trim(), StringComparison.OrdinalIgnoreCase));

    private static string? NullIfWhitespace(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static Guid DeterministicGuid(string value)
    {
        var bytes = System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes(value));
        return new Guid(bytes);
    }
}

using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Modules.ProcurementWorkflow.Services;
using Npgsql;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class WorkflowConfigurationsController
{
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
    threshold.threshold_id,
    threshold.procurement_type,
    threshold.min_amount,
    threshold.max_amount,
    threshold.approval_route,
    threshold.approval_authority_code,
    threshold.approval_authority_label,
    threshold.requires_cgis_approval,
    threshold.requires_board,
    threshold.requires_bpp,
    threshold.governance_body_id,
    body.body_name AS governance_body_name,
    threshold.status,
    threshold.notes,
    threshold.updated_at
FROM procurement_workflow.approval_thresholds threshold
LEFT JOIN procurement_workflow.governance_bodies body
    ON body.body_id = threshold.governance_body_id
ORDER BY threshold.procurement_type NULLS FIRST, threshold.min_amount ASC;";

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

    private async Task<List<WorkflowConfigurationGovernanceBodyResult>> GetGovernanceBodiesAsync(NpgsqlConnection conn, CancellationToken ct)
    {
        const string sql = @"
SELECT body_id, body_code, body_name, body_type, is_active
FROM procurement_workflow.governance_bodies
ORDER BY body_name ASC;";

        var results = new List<WorkflowConfigurationGovernanceBodyResult>();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(new WorkflowConfigurationGovernanceBodyResult(
                reader.GetGuid(reader.GetOrdinal("body_id")),
                reader.GetString(reader.GetOrdinal("body_code")),
                reader.GetString(reader.GetOrdinal("body_name")),
                reader.GetString(reader.GetOrdinal("body_type")),
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
                state.PrimaryOwners.FirstOrDefault() ?? "comptroller_procurement",
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
            reader.GetString(reader.GetOrdinal("approval_authority_code")),
            reader.GetString(reader.GetOrdinal("approval_authority_label")),
            reader.GetBoolean(reader.GetOrdinal("requires_cgis_approval")),
            reader.GetBoolean(reader.GetOrdinal("requires_board")),
            reader.GetBoolean(reader.GetOrdinal("requires_bpp")),
            reader.IsDBNull(reader.GetOrdinal("governance_body_id")) ? null : reader.GetGuid(reader.GetOrdinal("governance_body_id")),
            reader.IsDBNull(reader.GetOrdinal("governance_body_name")) ? null : reader.GetString(reader.GetOrdinal("governance_body_name")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.IsDBNull(reader.GetOrdinal("notes")) ? null : reader.GetString(reader.GetOrdinal("notes")),
            reader.IsDBNull(reader.GetOrdinal("updated_at")) ? null : reader.GetDateTime(reader.GetOrdinal("updated_at")));

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


namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public record WorkflowConfigurationResult(
    string Title,
    string Summary,
    IReadOnlyList<WorkflowConfigurationStageResult> Stages,
    IReadOnlyList<WorkflowConfigurationTransitionResult> Transitions,
    IReadOnlyList<WorkflowConfigurationRoleTaskResult> RoleTasks,
    IReadOnlyList<WorkflowConfigurationThresholdResult> Thresholds,
    IReadOnlyList<WorkflowConfigurationRoleResult> Roles);

public record WorkflowConfigurationStageResult(
    string StageKey,
    string PhaseKey,
    string StageTitle,
    string StageDescription,
    int SequenceNo,
    bool IsDecisionGate,
    bool IsStart,
    bool IsTerminal,
    string PrimaryOwnerRole,
    string? PpaReference,
    DateTime? UpdatedAt);

public record WorkflowConfigurationTransitionResult(
    Guid TransitionId,
    string FromStageKey,
    string ToStageKey,
    string TransitionCondition,
    DateTime? CreatedAt);

public record WorkflowConfigurationRoleTaskResult(
    Guid RoleTaskId,
    string RoleKey,
    string DisplayName,
    string StageKey,
    string TaskDescription,
    string ExpectedOutcome,
    DateTime? CreatedAt);

public record WorkflowConfigurationThresholdResult(
    Guid ThresholdId,
    string? ProcurementType,
    decimal MinAmount,
    decimal? MaxAmount,
    string ApprovalRoute,
    bool RequiresBoard,
    bool RequiresBpp,
    string Status,
    string? Notes,
    DateTime? UpdatedAt);

public record WorkflowConfigurationRoleResult(
    string RoleName,
    string? Description,
    bool IsActive);

public record WorkflowStageUpdateRequest(
    string? PhaseKey,
    string? StageTitle,
    string? StageDescription,
    int? SequenceNo,
    bool? IsDecisionGate,
    bool? IsStart,
    bool? IsTerminal,
    string? PrimaryOwnerRole,
    string? PpaReference);

public record WorkflowTransitionCreateRequest(
    string FromStageKey,
    string ToStageKey,
    string TransitionCondition);

public record WorkflowRoleTaskCreateRequest(
    string RoleKey,
    string DisplayName,
    string StageKey,
    string TaskDescription,
    string ExpectedOutcome);

public record WorkflowThresholdCreateRequest(
    string? ProcurementType,
    decimal MinAmount,
    decimal? MaxAmount,
    string ApprovalRoute,
    bool RequiresBoard,
    bool RequiresBpp,
    string? Status,
    string? Notes);

public record WorkflowThresholdUpdateRequest(
    string? ProcurementType,
    decimal? MinAmount,
    decimal? MaxAmount,
    string? ApprovalRoute,
    bool? RequiresBoard,
    bool? RequiresBpp,
    string? Status,
    string? Notes);

namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public record WorkflowBlueprintResult(
    string Title,
    string Summary,
    string ThresholdSource,
    string? CurrentRole,
    IReadOnlyList<string> DatabaseTables,
    IReadOnlyList<WorkflowPhaseResult> Phases,
    IReadOnlyList<WorkflowStateResult> States,
    IReadOnlyList<WorkflowTransitionResult> Transitions,
    IReadOnlyList<WorkflowRoleTaskResult> RoleTasks,
    IReadOnlyList<WorkflowThresholdBandResult> Thresholds);

public record WorkflowPhaseResult(
    string Id,
    string Title,
    string Description,
    int Sequence);

public record WorkflowStateResult(
    string Id,
    string PhaseId,
    string Title,
    string Description,
    int Sequence,
    bool IsDecisionGate,
    bool IsStart,
    bool IsTerminal,
    string PpaReference,
    IReadOnlyList<string> PrimaryOwners,
    IReadOnlyList<string> Actions);

public record WorkflowTransitionResult(
    string FromStateId,
    string ToStateId,
    string Condition);

public record WorkflowRoleTaskResult(
    string Role,
    string DisplayName,
    string StateId,
    string Task,
    string ExpectedOutcome);

public record WorkflowThresholdBandResult(
    string ProcurementType,
    decimal MinAmount,
    decimal? MaxAmount,
    string ApprovalRoute,
    string ApprovalAuthorityCode,
    string ApprovalAuthorityLabel,
    bool RequiresCgisApproval,
    bool RequiresBoard,
    bool RequiresBpp,
    Guid? GovernanceBodyId,
    string? GovernanceBodyName,
    string Notes);

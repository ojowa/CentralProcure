using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.DTOs;

public record WorkflowRuntimeDisplayResponse(
    Guid InstanceId,
    string EntityType,
    Guid EntityId,
    string CurrentStageKey,
    string CurrentStageTitle,
    string CurrentPhaseKey,
    string? CurrentStatus,
    string? RecordTitle,
    string? ParentEntityType,
    Guid? ParentEntityId,
    decimal? Amount,
    string? ProcurementType,
    Guid? ThresholdId,
    string? LastTransitionReason,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<WorkflowRuntimeTransitionSummary> NextTransitions,
    WorkflowRuntimeDisplay Display);

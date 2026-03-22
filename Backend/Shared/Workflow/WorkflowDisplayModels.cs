namespace eProcurement.Shared.Workflow;

public sealed record WorkflowPhaseDisplayItem(
    string PhaseKey,
    string PhaseLabel,
    int Sequence,
    string Color,
    string Status);

public sealed record WorkflowRuntimeDisplay(
    string CurrentStageKey,
    string CurrentStageTitle,
    string CurrentPhaseKey,
    string CurrentPhaseLabel,
    IReadOnlyList<WorkflowPhaseDisplayItem> Phases);

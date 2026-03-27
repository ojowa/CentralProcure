namespace eProcurement.Shared.Workflow;

public static class WorkflowDisplayMapper
{
    private static readonly (string Id, string Title, int Sequence)[] Phases =
    [
        ("app_planning", "APP Planning", 1),
        ("threshold_control", "Threshold Control", 2),
        ("procurement_execution", "Procurement Execution", 3),
        ("post_award", "Post-Award", 4),
        ("review_and_oversight", "Review and Oversight", 5)
    ];

    private static readonly IReadOnlyDictionary<string, string> StagePhaseMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["department_need_capture"] = "app_planning",
        ["department_head_endorsement"] = "app_planning",
        ["budget_allocation_and_confirmation"] = "app_planning",
        ["comptroller_procurement_review"] = "app_planning",
        ["planning_committee_review"] = "app_planning",
        ["app_approval"] = "app_planning",
        ["procurement_initiation"] = "threshold_control",
        ["threshold_resolution"] = "threshold_control",
        ["method_validation"] = "threshold_control",
        ["solicitation"] = "procurement_execution",
        ["bid_opening"] = "procurement_execution",
        ["evaluation"] = "procurement_execution",
        ["tenders_board_review"] = "procurement_execution",
        ["accounting_officer_review"] = "procurement_execution",
        ["bpp_no_objection"] = "procurement_execution",
        ["award_and_publication"] = "post_award",
        ["contract_execution"] = "post_award",
        ["inspection_and_payment"] = "post_award",
        ["closeout_and_audit"] = "review_and_oversight",
        ["administrative_review"] = "review_and_oversight"
    };

    private static readonly IReadOnlyDictionary<string, string> PhaseColors = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["app_planning"] = "#3b82f6",
        ["threshold_control"] = "#f59e0b",
        ["procurement_execution"] = "#a855f7",
        ["post_award"] = "#10b981",
        ["review_and_oversight"] = "#64748b"
    };

    public static WorkflowRuntimeDisplay Build(WorkflowRuntimeSnapshot snapshot)
        => Build(snapshot.CurrentStageKey, snapshot.CurrentStageTitle, snapshot.CurrentPhaseKey);

    public static WorkflowRuntimeDisplay Build(string currentStageKey, string currentStageTitle, string? currentPhaseKey = null)
    {
        var resolvedPhaseKey = ResolvePhaseKey(currentStageKey, currentPhaseKey);
        var orderedPhases = Phases.OrderBy(phase => phase.Sequence).ToArray();
        var phases = orderedPhases
            .Select(phase => new WorkflowPhaseDisplayItem(
                phase.Id,
                phase.Title,
                phase.Sequence,
                PhaseColors.TryGetValue(phase.Id, out var color) ? color : "#64748b",
                ResolvePhaseStatus(orderedPhases, resolvedPhaseKey, phase.Id, currentStageKey)))
            .ToArray();
        var currentPhase = phases.FirstOrDefault(phase => string.Equals(phase.PhaseKey, resolvedPhaseKey, StringComparison.OrdinalIgnoreCase))
            ?? new WorkflowPhaseDisplayItem(resolvedPhaseKey, resolvedPhaseKey, 0, "#64748b", "active");

        return new WorkflowRuntimeDisplay(
            currentStageKey,
            currentStageTitle,
            resolvedPhaseKey,
            currentPhase.PhaseLabel,
            phases);
    }

    private static string ResolvePhaseKey(string currentStageKey, string? currentPhaseKey)
    {
        if (!string.IsNullOrWhiteSpace(currentPhaseKey))
        {
            return currentPhaseKey;
        }

        return StagePhaseMap.TryGetValue(currentStageKey, out var phaseKey)
            ? phaseKey
            : "review_and_oversight";
    }

    private static string ResolvePhaseStatus(
        IReadOnlyList<(string Id, string Title, int Sequence)> orderedPhases,
        string currentPhaseKey,
        string phaseKey,
        string currentStageKey)
    {
        if (string.Equals(currentStageKey, "administrative_review", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(phaseKey, "review_and_oversight", StringComparison.OrdinalIgnoreCase))
        {
            return "active";
        }
        var currentIndex = Array.FindIndex(orderedPhases.ToArray(), phase => string.Equals(phase.Id, currentPhaseKey, StringComparison.OrdinalIgnoreCase));
        var phaseIndex = Array.FindIndex(orderedPhases.ToArray(), phase => string.Equals(phase.Id, phaseKey, StringComparison.OrdinalIgnoreCase));
        if (currentIndex < 0 || phaseIndex < 0)
        {
            return "pending";
        }

        if (phaseIndex < currentIndex)
        {
            return "completed";
        }

        return phaseIndex == currentIndex ? "active" : "pending";
    }
}

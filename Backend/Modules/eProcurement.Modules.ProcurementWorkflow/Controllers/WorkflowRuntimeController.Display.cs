using eProcurement.Modules.ProcurementWorkflow.DTOs;
using eProcurement.Shared.Workflow;

namespace eProcurement.Modules.ProcurementWorkflow.Controllers;

public partial class WorkflowRuntimeController
{
    private static WorkflowRuntimeDisplayResponse MapDisplayResponse(WorkflowRuntimeSnapshot snapshot)
        => new(
            snapshot.InstanceId,
            snapshot.EntityType,
            snapshot.EntityId,
            snapshot.CurrentStageKey,
            snapshot.CurrentStageTitle,
            snapshot.CurrentPhaseKey,
            snapshot.CurrentStatus,
            snapshot.RecordTitle,
            snapshot.ParentEntityType,
            snapshot.ParentEntityId,
            snapshot.Amount,
            snapshot.ProcurementType,
            snapshot.ThresholdId,
            snapshot.LastTransitionReason,
            snapshot.CreatedAt,
            snapshot.UpdatedAt,
            snapshot.NextTransitions,
            WorkflowDisplayMapper.Build(snapshot));
}
